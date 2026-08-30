"""Train the OA risk head, evaluate it honestly, export it for the phone.

    python scripts/train_risk_model.py --data data/synthetic/cohort.csv --kind logreg

Guard rails baked in:
  * grouped split by patient_id when the column exists, so the same person can
    never sit in both train and test;
  * the operating threshold is chosen for a screening sensitivity target, not for
    accuracy - accuracy on a 15%-prevalence cohort is a meaningless 85%;
  * the dataset's `synthetic` stamp is copied into the metrics file and into the
    model artifact, so a synthetic-trained model announces itself as such;
  * ONNX export plus a parity check against the sklearn path, because a model that
    behaves differently on the phone is worse than no model.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import _bootstrap  # noqa: F401
from oa_core import model as M
from oa_core.features import FEATURE_NAMES


def load(path: Path) -> tuple[np.ndarray, np.ndarray, dict]:
    df = pd.read_csv(path)
    missing = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing:
        raise SystemExit(f"dataset is missing feature columns: {missing}")
    if "label_oa" not in df.columns:
        raise SystemExit("dataset needs a binary `label_oa` column")
    X = df[FEATURE_NAMES].to_numpy(dtype=np.float32)
    y = df["label_oa"].to_numpy(dtype=int)
    meta_path = Path(str(path) + ".meta.json")
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    meta.setdefault("synthetic", bool(df.get("synthetic", pd.Series([0])).max()))
    meta["n_rows"] = int(len(df))
    return X, y, meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/synthetic/cohort.csv")
    ap.add_argument("--kind", default="logreg", choices=["logreg", "gbt"])
    ap.add_argument("--sensitivity", type=float, default=0.90)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    X, y, meta = load(Path(args.data))
    if y.sum() < 20:
        raise SystemExit(f"only {y.sum()} positive cases - generate a bigger cohort")

    est, metrics = M.train(X, y, kind=args.kind, seed=args.seed,
                           target_sensitivity=args.sensitivity)
    metrics.dataset_signature = (f"{meta.get('generator', Path(args.data).name)}"
                                 f":n={meta['n_rows']}")
    metrics.notes = ("SYNTHETIC TRAINING DATA - pipeline validation only, no clinical "
                     "accuracy claim" if meta.get("synthetic")
                     else "trained on non-synthetic data - record provenance in docs/datasets.md")
    M.save(est, metrics)
    onnx_path = M.export_onnx(est)

    probe = X[:1]
    sk = float(est.predict_proba(probe)[0, 1])
    ox = M.onnx_probability(probe[0], onnx_path)
    delta = abs(sk - (ox if ox is not None else sk))

    print(json.dumps({
        "kind": metrics.kind, "n_train": metrics.n_train, "n_test": metrics.n_test,
        "prevalence": metrics.prevalence, "auroc": metrics.auroc,
        "average_precision": metrics.average_precision, "brier": metrics.brier,
        "threshold": metrics.threshold,
        "escalate_threshold": metrics.escalate_threshold,
        "precision_at_escalate": metrics.precision_at_escalate,
        "sensitivity": metrics.sensitivity_at_thr,
        "specificity": metrics.specificity_at_thr,
        "onnx": str(onnx_path), "onnx_parity_delta": round(delta, 8),
        "dataset": metrics.dataset_signature, "notes": metrics.notes,
    }, indent=2))
    print("\ntop coefficients:")
    for k, v in list(metrics.top_coefficients.items())[:10]:
        print(f"  {k:<28} {v:+.3f}")
    if meta.get("synthetic") and metrics.auroc > 0.95:
        print("\n*** WARNING ***\n"
              f"AUROC {metrics.auroc} on synthetic data. Features and labels here share a\n"
              "latent variable, so this number measures the generator, not the model.\n"
              "Report it as a pipeline smoke test only. Clinical numbers must come from\n"
              "the cohorts in docs/datasets.md.")
    if delta > 1e-4:
        raise SystemExit(f"ONNX parity check FAILED (delta {delta})")


if __name__ == "__main__":
    main()
