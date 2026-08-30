"""ML risk head: train on CPU, ship as ONNX, run identically on phone and laptop.

Deliberately small models (logistic regression / shallow GBT) because:
  * the labelled cohorts we can legally use are tabular and in the thousands,
    not millions - a deep net would only overfit;
  * a logistic model exports to a <50 KB ONNX file that onnxruntime-react-native
    runs offline in ~1 ms, which is the whole point of the PS;
  * coefficients can be shown to a clinician.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Optional

import numpy as np

from .features import FEATURE_NAMES, N_FEATURES

MODEL_DIR = Path(__file__).resolve().parents[3] / "artifacts"
JOBLIB_PATH = MODEL_DIR / "oa_risk_model.joblib"
ONNX_PATH = MODEL_DIR / "oa_risk_model.onnx"
METRICS_PATH = MODEL_DIR / "oa_risk_metrics.json"


@dataclass
class TrainMetrics:
    kind: str
    n_train: int
    n_test: int
    prevalence: float
    auroc: float
    average_precision: float
    brier: float
    sensitivity_at_thr: float
    specificity_at_thr: float
    threshold: float
    escalate_threshold: float
    precision_at_escalate: float
    feature_names: list[str]
    top_coefficients: dict[str, float]
    dataset_signature: str = ""
    notes: str = ""


def build_estimator(kind: str = "logreg", seed: int = 7):
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler

    if kind == "logreg":
        return Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000, class_weight="balanced",
                                       C=0.5, random_state=seed)),
        ])
    if kind == "gbt":
        # GradientBoostingClassifier, not HistGradientBoosting: the Hist variant hits a
        # skl2onnx 1.20 + onnx 1.22 bug (bool written into an int attribute) and cannot
        # be exported, and a model that will not run on the phone is not shippable here.
        # At a few thousand rows the classic implementation is fast enough anyway.
        return Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("clf", GradientBoostingClassifier(
                max_depth=3, n_estimators=250, learning_rate=0.06,
                subsample=0.9, random_state=seed)),
        ])
    raise ValueError(f"unknown model kind {kind!r}")


def train(X: np.ndarray, y: np.ndarray, kind: str = "logreg",
          seed: int = 7, target_sensitivity: float = 0.90,
          escalate_specificity: float = 0.80,
          groups: Optional[np.ndarray] = None) -> tuple[Any, TrainMetrics]:
    """Fit and evaluate. Threshold is chosen for SCREENING, not accuracy.

    A screening tool that misses OA cases is useless, so we pick the operating
    point that reaches `target_sensitivity` and report the specificity we paid
    for it - never the 0.5 default.
    """
    from sklearn.metrics import (average_precision_score, brier_score_loss,
                                 roc_auc_score, roc_curve)
    from sklearn.model_selection import train_test_split

    if X.shape[1] != N_FEATURES:
        raise ValueError(f"expected {N_FEATURES} features, got {X.shape[1]}")

    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=seed,
                                          stratify=y)
    est = build_estimator(kind, seed).fit(Xtr, ytr)
    p = est.predict_proba(Xte)[:, 1]

    fpr, tpr, thr = roc_curve(yte, p)
    idx = int(np.argmax(tpr >= target_sensitivity))
    chosen = float(thr[idx]) if np.isfinite(thr[idx]) else 0.5

    # A second, deliberately stricter cut. `chosen` answers "is this person worth
    # screening in at all?" and is tuned for sensitivity, so it fires on most of
    # the cohort - useful as a binary screen, useless as evidence for raising
    # someone's printed risk band. `escalate` is the point where the model is
    # selective enough that acting on it means something: the probability that
    # `escalate_specificity` of true negatives fall below. risk.py lets the model
    # push a band up only above this cut, never above the sensitivity cut.
    neg = p[yte == 0]
    escalate = float(np.quantile(neg, escalate_specificity)) if len(neg) else 0.5
    escalate = max(escalate, chosen)
    flagged = p >= escalate
    precision = float(yte[flagged].mean()) if flagged.any() else 0.0

    coefs: dict[str, float] = {}
    clf = est.named_steps["clf"]
    if hasattr(clf, "coef_"):
        pairs = sorted(zip(FEATURE_NAMES, clf.coef_[0]), key=lambda t: -abs(t[1]))
        coefs = {k: round(float(v), 4) for k, v in pairs[:12]}

    m = TrainMetrics(
        kind=kind, n_train=int(len(ytr)), n_test=int(len(yte)),
        prevalence=round(float(y.mean()), 4),
        auroc=round(float(roc_auc_score(yte, p)), 4),
        average_precision=round(float(average_precision_score(yte, p)), 4),
        brier=round(float(brier_score_loss(yte, p)), 4),
        sensitivity_at_thr=round(float(tpr[idx]), 4),
        specificity_at_thr=round(float(1 - fpr[idx]), 4),
        threshold=round(chosen, 4),
        escalate_threshold=round(escalate, 4),
        precision_at_escalate=round(precision, 4),
        feature_names=FEATURE_NAMES, top_coefficients=coefs,
    )
    return est, m


def save(est: Any, metrics: TrainMetrics) -> None:
    import joblib
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"estimator": est, "threshold": metrics.threshold,
                 "escalate_threshold": metrics.escalate_threshold,
                 "feature_names": FEATURE_NAMES, "kind": metrics.kind}, JOBLIB_PATH)
    METRICS_PATH.write_text(json.dumps(asdict(metrics), indent=2))


def export_onnx(est: Any) -> Path:
    """Export for onnxruntime / onnxruntime-react-native (on-device inference)."""
    from skl2onnx import to_onnx
    dummy = np.zeros((1, N_FEATURES), dtype=np.float32)
    try:
        onx = to_onnx(est, dummy, options={id(est.named_steps["clf"]): {"zipmap": False}})
    except Exception as e:                      # noqa: BLE001 - surfaced, not swallowed
        raise RuntimeError(
            f"ONNX export failed for {type(est.named_steps['clf']).__name__}: {e}. "
            "The on-device path needs this file - switch --kind or pin skl2onnx."
        ) from e
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    ONNX_PATH.write_bytes(onx.SerializeToString())
    return ONNX_PATH


class OARiskModel:
    """Thin, always-safe wrapper. If no model is trained yet, `.available` is False
    and the pipeline falls back to the rule engine alone."""

    def __init__(self, path: Path = JOBLIB_PATH):
        self.available = False
        self.threshold = 0.5
        self.escalate_threshold = 0.5
        self.version = "none"
        self._est = None
        if path.exists():
            import joblib
            blob = joblib.load(path)
            if blob.get("feature_names") != FEATURE_NAMES:
                raise RuntimeError("feature drift: retrain the model, schema changed")
            self._est = blob["estimator"]
            self.threshold = float(blob.get("threshold", 0.5))
            # An artifact trained before the two-threshold split has no escalation
            # cut; 0.5 is the conservative reading, never below the screening cut.
            self.escalate_threshold = max(float(blob.get("escalate_threshold", 0.5)),
                                          self.threshold)
            self.version = f"{blob.get('kind', 'unknown')}-{path.stat().st_mtime_ns:x}"[:28]
            self.available = True

    def probability(self, vector: np.ndarray) -> Optional[float]:
        if not self.available:
            return None
        return float(self._est.predict_proba(vector.reshape(1, -1))[0, 1])


def onnx_probability(vector: np.ndarray, path: Path = ONNX_PATH) -> Optional[float]:
    """Parity check: the exact code path the phone runs."""
    if not path.exists():
        return None
    import onnxruntime as ort
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    out = sess.run(None, {sess.get_inputs()[0].name: vector.reshape(1, -1).astype(np.float32)})
    probs = out[1]
    return float(np.asarray(probs).reshape(1, -1)[0, 1])
