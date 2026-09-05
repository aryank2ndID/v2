"""
SANDHI — train on REAL clinical gait data.

Dataset: Voisard et al. 2025, "A Dataset of Clinical Gait Signals with Wearable
Sensors from Healthy, Neurological, and Orthopedic Cohorts" (figshare
10.6084/m9.figshare.28806086). We take the two cohorts relevant to SANDHI:

    KOA    — 18 subjects / 78 trials, knee osteoarthritis
    HS     — 73 subjects / 360 trials, healthy

and build the SANDHI screen as KOA-vs-healthy.

READ THIS BEFORE QUOTING ANY NUMBER FROM HERE
---------------------------------------------
This is a REAL-DATA baseline, but it is NOT clinical validation of the SANDHI
kit. The Voisard dataset wears its IMUs on head / lower back / feet; the SANDHI
kit wears thigh / shin / piezo. The sensor geometry is different, so the gait
channels available here (foot-contact timing, trunk movement) are a partial
subset of what the kit produces. Numbers below quantify how much of KOA-vs-
healthy signal survives in THAT subset with the kit's feature vocabulary.
"""
import argparse, json, os, sys, time, warnings
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gbm import GBM, roc_auc

warnings.filterwarnings("ignore", category=RuntimeWarning)

DATA = os.environ.get("SANDHI_REAL_DATA", "/run/media/ak/Drive/datasets/clinical-gait-imu/dataset/data")
SRC = {"left": "LF", "right": "RF"}

# column indices into the processed file (tab-delimited, 37 columns)
COLS = {
    "LB": {"freeacc": (13, 14, 15), "gyr": (16, 17, 18)},
    "LF": {"freeacc": (22, 23, 24), "gyr": (25, 26, 27)},
    "RF": {"freeacc": (31, 32, 33), "gyr": (34, 35, 36)},
}

# ordered columns of the feature matrix
FEATURE_NAMES = [
    # intake — from the metadata (limited set: dataset has no occupation/stairs)
    "age", "sex_f", "bmi", "womac_pain",
    # gait — foot-contact timing + trunk, the channels this dataset offers
    "cadence_spm", "stride_time_s", "stride_time_cv_pct", "stance_pct",
    "double_support_pct", "step_asym_pct", "gait_speed_est_mps",
    "trunk_swing_amp", "trunk_smoothness_ldlj",
]
INTAKE = ["age", "sex_f", "bmi", "womac_pain"]
GAIT = [n for n in FEATURE_NAMES if n not in INTAKE]


def _load_processed(path):
    """Tab-delimited IMU matrix; drop ragged tail rows (some files end with a
    partial line). Returns an Nx37 float array."""
    out = []
    with open(path) as fh:
        fh.readline()  # header
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) == 37:
                try:
                    out.append([float(v) for v in parts])
                except ValueError:
                    pass
    return np.array(out, dtype=float)


def _cv_pct(v):
    v = np.asarray(v, dtype=float)
    if len(v) < 2 or np.mean(v) == 0:
        return 0.0
    return float(100.0 * np.std(v) / np.mean(v))


def _refine(x, idx):
    out = []
    for i in idx:
        i = int(i)
        if i <= 0 or i >= len(x) - 1:
            out.append(float(i))
            continue
        a, b, c = float(x[i - 1]), float(x[i]), float(x[i + 1])
        den = a - 2.0 * b + c
        out.append(float(i) + (0.5 * (a - c) / den if abs(den) > 1e-12 else 0.0))
    return np.array(out, dtype=float)


def _peak_onsets(ts):
    """Foot-switch onsets from a mid-stance window list."""
    a = np.array([t[0] for t in ts], dtype=float)
    a = _refine(np.zeros(int(a[-1] + 4)), a + 1)
    return a - 1


def parse_trial(meta_path, proc_path):
    meta = json.load(open(meta_path))
    if meta["pathologyKey"] not in ("KOA", "HS"):
        return None

    # --- intake ---------------------------------------------------------
    womac = meta["evaluationScoreValue"]
    f = {
        "age": float(meta["age"]),
        "sex_f": float(meta["gender"] == "F"),
        "bmi": float(meta["BMI"]),
        # WOMAC /100 -> SANDHI 20-point scale
        "womac_pain": float((womac / 5.0) if (womac is not None) else 0.0),
    }

    # --- gait -----------------------------------------------------------
    t = _load_processed(proc_path)
    fs = float(meta["freq"]) or 100.0

    ls, rs = meta.get("leftGaitEvents") or [], meta.get("rightGaitEvents") or []
    if len(ls) < 3 or len(rs) < 3:
        return None

    lo, hi = meta.get("uturnBoundaries", [0, len(t)])
    # stride events on each limb: straight-walk segments are OUTSIDE the turn
    le = [e for e in ls if hi == 0 or (e[0] < lo or e[0] > hi)]
    re_ = [e for e in rs if hi == 0 or (e[0] < lo or e[0] > hi)]
    if len(le) < 3 or len(re_) < 3:
        return None
    sl = _peak_onsets(le)
    sr = _peak_onsets(re_)
    if len(sl) < 2 or len(sr) < 2:
        return None

    def stride_times(onsets):
        d = np.diff(onsets) / fs
        d = d[(d > 0.4) & (d < 3.0)]
        return d

    dl, dr = stride_times(sl), stride_times(sr)
    if len(dl) < 2 or len(dr) < 2:
        return None
    stride = float(np.median(np.concatenate([dl, dr])))
    cadence = 120.0 / stride
    # within-limb CV pooled + cross-limb asymmetry
    cv = 0.5 * (_cv_pct(dl) + _cv_pct(dr))
    m, n = float(np.mean(dl)), float(np.mean(dr))
    asym = float(100.0 * abs(m - n) / (0.5 * (m + n))) if (m + n) else 0.0

    # stance / double support from window widths (each event window is the
    # mid-stance contact window on that limb)
    wl = np.array([e[1] - e[0] for e in le], dtype=float)
    wr = np.array([e[1] - e[0] for e in re_], dtype=float)
    stance_frac = 0.5 * (float(np.mean(wl)) / stride + float(np.mean(wr)) / stride)
    stance_pct = float(np.clip(stance_frac * 100.0, 30.0, 85.0))
    double_support = float(np.clip(2.0 * (stance_pct - 45.0), 0.0, 60.0))

    # gait speed proxy: cadence + a constant step-length scale (no knee angle
    # channel in this dataset, so fixed stride coefficient ~0.72*height)
    step_len = 0.72 * meta["height"] / 2.0
    speed = float(np.clip(step_len * (cadence / 60.0), 0.2, 2.2))

    # trunk swing amplitude + smoothness from the lower-back gyro (dominant axis)
    g = t[:, COLS["LB"]["gyr"]]
    mg = np.linalg.norm(g, axis=1)
    p98 = float(np.percentile(mg, 98))
    f["cadence_spm"] = cadence
    f["stride_time_s"] = stride
    f["stride_time_cv_pct"] = cv
    f["stance_pct"] = stance_pct
    f["double_support_pct"] = double_support
    f["step_asym_pct"] = asym
    f["gait_speed_est_mps"] = speed
    f["trunk_swing_amp"] = p98
    # log dimensionless jerk of the trunk during the straight walk
    seg = mg[lo:hi]
    if len(seg) < 8:
        seg = mg
    d = np.diff(seg) * fs
    dur = len(seg) / fs
    peak = max(1e-6, float(np.max(np.abs(seg))))
    dlj = (dur ** 3 / peak ** 2) * float(np.sum(d ** 2)) / fs
    f["trunk_smoothness_ldlj"] = -float(np.log(max(dlj, 1e-12)))

    return dict(meta=meta, features=f, subject=meta["subject"],
                cohort=meta["pathologyKey"], label=int(meta["pathologyKey"] == "KOA"))


def load_cohort():
    rows = []
    for cohort in ("ortho", "healthy"):
        base = os.path.join(DATA, cohort)
        if not os.path.isdir(base):
            continue
        for dirpath, _, files in os.walk(base):
            metas = [f for f in files if f.endswith("_meta.json")]
            if not metas:
                continue
            meta_path = os.path.join(dirpath, metas[0])
            trial_id = metas[0][:-len("_meta.json")]
            proc = os.path.join(dirpath, f"{trial_id}_processed_data.txt")
            if not os.path.isfile(proc):
                continue
            r = parse_trial(meta_path, proc)
            if r:
                rows.append(r)
    return rows


def to_matrix(rows, cols):
    X = np.array([[float(r["features"][c]) for c in cols] for r in rows], dtype=float)
    y = np.array([r["label"] for r in rows], dtype=int)
    return X, y


def clustered_ci(subject_idx, T, S, n_boot=500, seed=0):
    """Clustered bootstrap 95% CI for AUC: resample whole subjects (not trials)
    to respect within-subject correlation."""
    rng = np.random.default_rng(seed)
    n_subj = int(subject_idx.max()) + 1
    aucs = []
    for _ in range(n_boot):
        picked = rng.integers(0, n_subj, size=n_subj)
        keep = np.isin(subject_idx, picked)
        Ja = np.array([np.isin(subject_idx, [p]).sum() for p in picked]).sum()
        J = np.bincount(picked, minlength=n_subj)
        # oversample to keep class balance roughly: take as many as it took
        if keep.sum() < 10:
            continue
        a = roc_auc(T[keep], S[keep])
        if a is not None:
            aucs.append(a)
    aucs = np.array(aucs)
    return float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))


def loso_cv(rows, cols, n_trees=300, seed=42, return_subjects=False):
    """Leave-one-SUBJECT-out: tune hyperparams once on a fixed split, then score
    every subject with a model never trained on any of their trials."""
    X, y = to_matrix(rows, cols)
    subjects = sorted({r["subject"] for r in rows})
    subj_ix = np.array([subjects.index(r["subject"]) for r in rows])

    # pick val subject for early stopping from subjects that have >1 trial
    valsub = next((s for s in subjects if sum(1 for r in rows if r["subject"] == s) > 1), subjects[0])
    va_mask = np.array([r["subject"] == valsub for r in rows])
    tr_mask = ~va_mask

    m = GBM(n_trees=n_trees, depth=4, lr=0.055, lam=1.2, min_child_weight=10.0,
            subsample=0.85, colsample=0.8, n_bins=64, seed=seed)
    m.fit(X[tr_mask], y[tr_mask].astype(float), X[va_mask], y[va_mask].astype(float),
          early_stop=35)

    scores, truths = [], []
    for si, s in enumerate(subjects):
        mask = subj_ix == si
        mm = GBM(n_trees=len(m.trees), depth=4, lr=0.055, lam=1.2, min_child_weight=10.0,
                 subsample=0.85, colsample=0.8, n_bins=64, seed=seed)
        mm.fit(X[~mask], y[~mask].astype(float))
        scores.append(mm.predict_proba(X[mask]))
        truths.append(y[mask])
    S = np.concatenate(scores)
    T = np.concatenate(truths)
    ord_subj = np.concatenate([np.full(len(t), si, dtype=int)
                               for si, t in enumerate(truths)])
    if return_subjects:
        return T, S, len(subjects), ord_subj
    return T, S, len(subjects)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n_trees", type=int, default=300)
    a = ap.parse_args()

    t0 = time.time()
    print("SANDHI — real-data baseline (KOA vs healthy)")
    print("=" * 62)
    rows = load_cohort()
    koa = sum(1 for r in rows if r["label"] == 1)
    hs = sum(1 for r in rows if r["label"] == 0)
    subs = len({r["subject"] for r in rows})
    print(f"  trials: {len(rows)}  (KOA {koa} / healthy {hs}), subjects {subs}")
    print(f"  features: {len(FEATURE_NAMES)} ({len(INTAKE)} intake, {len(GAIT)} gait)")
    print(f"  load+extract: {time.time()-t0:.1f}s")

    def run(cols, label):
        T, S, ns, ord = loso_cv(rows, cols, n_trees=a.n_trees, return_subjects=True)
        auc = roc_auc(T, S)
        lo, hi = clustered_ci(ord, T, S)
        print(f"  {label:<34} AUC {auc:.4f} [{lo:.3f}-{hi:.3f}]  (LOSO / {ns} subjects)")
        return dict(auc=float(auc), ci=[float(lo), float(hi)])

    print("-" * 62)
    r_intake = run(INTAKE, "intake only (age/sex/BMI/WOMAC)")
    r_gait = run(GAIT, "gait only")
    r_full = run(FEATURE_NAMES, "intake + gait")
    print("-" * 62)
    d_auc = r_full["auc"] - r_intake["auc"]
    print(f"  gait adds  ΔAUC {d_auc:+.4f}  "
          f"(gait alone already reaches {r_gait['auc']:.4f})")
    if r_intake["auc"] >= 0.995:
        print(f"  NOTE: intake-only saturates — WOMAC + age separate these "
              f"cohorts near-perfectly; the sensors' ceiling is best read "
              f"from 'gait only'.")

    outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
    os.makedirs(outdir, exist_ok=True)
    json.dump(dict(
        disclaimer=(
            "Real-data baseline on the Voisard 2025 clinical gait dataset "
            "(figshare 10.6084/m9.figshare.28806086), KOA-vs-healthy. Sensor "
            "placement differs from the SANDHI kit (head/lowerback/feet vs "
            "thigh/shin/piezo); gait features use foot-contact timing + trunk. "
            "Cohorts are not age-matched (KOA ~70y vs healthy ~38y), which "
            "inflates intake-only discrimination. Not clinical validation."),
        dataset=dict(name="Voisard2025_clinical_gait", trials=len(rows),
                     subjects=subs, koa=koa, healthy=hs),
        features=dict(names=FEATURE_NAMES, intake=INTAKE, gait=GAIT),
        results=dict(
            intake_only=dict(auc=r_intake["auc"], ci95=r_intake["ci"]),
            gait_only=dict(auc=r_gait["auc"], ci95=r_gait["ci"]),
            intake_plus_gait=dict(auc=r_full["auc"], ci95=r_full["ci"]),
            delta_intake_plus_gait_vs_intake=round(d_auc, 4)),
        cohort_age_mismatch=dict(koa_mean_age=float(np.mean([r["features"]["age"] for r in rows if r["label"] == 1])),
                                 healthy_mean_age=float(np.mean([r["features"]["age"] for r in rows if r["label"] == 0]))),
        elapsed_s=round(time.time() - t0, 1),
    ), open(os.path.join(outdir, "metrics_real.json"), "w"), indent=1)
    print(f"  wrote {os.path.join(outdir, 'metrics_real.json')}  ({time.time()-t0:.1f}s total)")


if __name__ == "__main__":
    main()