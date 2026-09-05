"""
SANDHI — train the on-device screening model.

    python3 train.py --n 14000

Outputs into ml/out/:
    model.json      the booster, loaded verbatim by the phone app
    metrics.json    honest held-out numbers + calibration + importances
    cohort.json     scored synthetic registry the dashboard renders
    parity.json     raw signal fixtures so the TS port can be proven identical

READ THIS BEFORE QUOTING ANY NUMBER FROM HERE
---------------------------------------------
The cohort is synthetic (ml/simulator.py). These metrics describe how well the
model recovers a simulated relationship. They are NOT clinical validation and
must never be presented as accuracy on patients. See docs/REALITY-MAP.md.
"""
import argparse, json, os, sys, time
from multiprocessing import Pool
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import simulator as S
import features as F
from gbm import GBM, roc_auc, brier, at_threshold

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
DATA = os.path.join(HERE, "..", "data")
DISTRICTS = json.load(open(os.path.join(DATA, "districts.json")))["districts"]

FIRST_NAMES_F = ["Anima","Bhaswati","Chumki","Dipika","Elizabeth","Fulmoni","Gitali","Hasina",
                 "Ibemhal","Jonali","Kamala","Lalrinpuii","Mamoni","Nirmala","Oinam","Purnima",
                 "Rekha","Sanjida","Tarali","Urmila","Vanlalruati","Wahida","Yashodhara","Zubeda"]
FIRST_NAMES_M = ["Ajoy","Biren","Chandan","Debojit","Elias","Ferdous","Gautam","Hiren","Imran",
                 "Jitendra","Kuldeep","Lalzuia","Mridul","Nabajyoti","Omeo","Pranab","Rupam",
                 "Sanjib","Tapan","Uttam","Vikram","Wangkhem","Yumnam","Zothan"]
SURNAMES = ["Baruah","Das","Deka","Gogoi","Hazarika","Kalita","Lyngdoh","Marak","Nongrum",
            "Phukan","Rabha","Saikia","Sangma","Terang","Vaiphei","Zeliang","Chakma","Debbarma",
            "Jamir","Khiangte","Lepcha","Momin","Ngullie","Rongmei"]


def _one(seed):
    rng = np.random.default_rng(seed)
    subj = S.sample_subject(rng)
    sess = S.synth_session(rng, subj)
    f = F.extract(sess, subj)
    return F.to_vector(f).tolist(), subj["label"], subj["kl_grade"], subj["_sev"], subj["occupation"]


def build_dataset(n, seed0=100000, workers=None):
    t0 = time.time()
    with Pool(workers or os.cpu_count()) as p:
        rows = p.map(_one, range(seed0, seed0 + n), chunksize=64)
    X = np.array([r[0] for r in rows], dtype=float)
    y = np.array([r[1] for r in rows], dtype=int)
    kl = np.array([r[2] for r in rows], dtype=int)
    sev = np.array([r[3] for r in rows], dtype=float)
    occ = [r[4] for r in rows]
    print(f"  generated {n} synthetic screenings in {time.time()-t0:.1f}s "
          f"({100*y.mean():.1f}% KL>=2)")
    return X, y, kl, sev, occ


def stratified_split(y, seed, fracs=(0.70, 0.15, 0.15)):
    rng = np.random.default_rng(seed)
    idx = {c: rng.permutation(np.where(y == c)[0]) for c in (0, 1)}
    out = [[], [], []]
    for c, ix in idx.items():
        a = int(fracs[0] * len(ix))
        b = a + int(fracs[1] * len(ix))
        out[0] += list(ix[:a]); out[1] += list(ix[a:b]); out[2] += list(ix[b:])
    return [np.array(sorted(o)) for o in out]


def calibration_bins(y, p, nbins=10):
    edges = np.linspace(0, 1, nbins + 1)
    out = []
    for i in range(nbins):
        m = (p >= edges[i]) & (p < edges[i + 1] if i < nbins - 1 else p <= 1.0)
        if m.sum() < 5:
            continue
        out.append(dict(bin=[round(edges[i], 2), round(edges[i + 1], 2)],
                        n=int(m.sum()), predicted=round(float(p[m].mean()), 4),
                        observed=round(float(y[m].mean()), 4)))
    return out


def pick_bands(y, p):
    """Two cut-points -> three bands.

    This is a SCREENING tool, so the referral cut is chosen for sensitivity
    (target >= 0.90): missing a case is worse than sending someone for a
    look. The 'low risk / no action' cut is chosen for a high negative
    predictive value so a green result is genuinely reassuring.
    """
    grid = np.linspace(0.02, 0.95, 187)
    refer = None
    for t in grid[::-1]:
        if at_threshold(y, p, t)["sensitivity"] >= 0.90:
            refer = float(t)
            break
    refer = refer if refer is not None else 0.20
    low = None
    for t in grid:
        r = at_threshold(y, p, t)
        if r["npv"] >= 0.97:
            low = float(t)
    low = min(low if low is not None else 0.08, refer * 0.62)
    return round(low, 3), round(refer, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=14000)
    ap.add_argument("--seed", type=int, default=42)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    print("SANDHI model build")
    print("=" * 62)
    X, y, kl, sev, occ = build_dataset(a.n, seed0=100000)

    tr, va, te = stratified_split(y, a.seed)
    print(f"  split  train {len(tr)}  val {len(va)}  test {len(te)}")

    print("  fitting gradient booster ...")
    m = GBM(n_trees=400, depth=4, lr=0.055, lam=1.2, min_child_weight=10.0,
            subsample=0.85, colsample=0.8, n_bins=64, seed=a.seed)
    t0 = time.time()
    m.fit(X[tr], y[tr].astype(float), X[va], y[va].astype(float),
          early_stop=35, verbose=True)
    print(f"  {len(m.trees)} trees in {time.time()-t0:.1f}s")

    p_te = m.predict_proba(X[te])
    p_va = m.predict_proba(X[va])
    auc = roc_auc(y[te], p_te)
    low_cut, refer_cut = pick_bands(y[va], p_va)
    print(f"  test AUC {auc:.4f}   Brier {brier(y[te], p_te):.4f}")
    print(f"  bands: low<{low_cut}  watch  refer>={refer_cut}")

    at_refer = at_threshold(y[te], p_te, refer_cut)
    at_low = at_threshold(y[te], p_te, low_cut)
    print(f"  @refer  sens {at_refer['sensitivity']:.3f}  spec {at_refer['specificity']:.3f}"
          f"  ppv {at_refer['ppv']:.3f}")
    print(f"  @low    npv  {at_low['npv']:.3f}")

    # ---- ablation: what does the hardware actually buy us? ----------------
    names = F.FEATURE_NAMES
    # Feature-source groups derived from FEATURE_NAMES order, NOT hardcoded
    # index ranges — ordering drift must not silently change what an ablation row
    # means. Gait is everything before the first STS feature; STS is everything
    # before the first intake feature.
    gait_end = names.index("sts_total_s")
    sts_end = names.index("age")
    groups = {
        "intake only (no kit)": [i for i, n in enumerate(names) if n in F.INTAKE_FEATURES],
        "intake + gait": [i for i, n in enumerate(names)
                          if n in F.INTAKE_FEATURES or i < gait_end],
        "intake + gait + STS": [i for i, n in enumerate(names)
                                if n in F.INTAKE_FEATURES or i < sts_end],
        "full kit (gait + STS + intake)": list(range(len(names))),
    }
    ablation = {}
    for label, cols in groups.items():
        mm = GBM(n_trees=400, depth=4, lr=0.055, lam=1.2, min_child_weight=10.0,
                 subsample=0.85, colsample=0.8, n_bins=64, seed=a.seed)
        mm.fit(X[tr][:, cols], y[tr].astype(float), X[va][:, cols],
               y[va].astype(float), early_stop=35)
        pa = mm.predict_proba(X[te][:, cols])
        ta = at_threshold(y[te], pa, refer_cut)
        ablation[label] = dict(auc=round(roc_auc(y[te], pa), 4),
                               n_features=len(cols),
                               sensitivity=ta["sensitivity"],
                               specificity=ta["specificity"])
        print(f"  ablation  {label:<24} AUC {ablation[label]['auc']:.4f}")

    imp = m.gain_importance()
    order = np.argsort(-imp)
    importances = [dict(feature=names[i], gain=round(float(imp[i]), 5)) for i in order]

    # ------------------------------------------------------------ export --
    model = m.to_json(names)
    model["bands"] = {"low": low_cut, "refer": refer_cut}
    model["trained"] = time.strftime("%Y-%m-%d")
    model["cohort"] = {"kind": "synthetic", "n": int(a.n),
                       "generator": "ml/simulator.py", "seed": 100000}
    json.dump(model, open(os.path.join(OUT, "model.json"), "w"), separators=(",", ":"))

    metrics = dict(
        disclaimer=("All numbers below are measured on a HELD-OUT SPLIT OF A "
                    "SYNTHETIC COHORT generated by ml/simulator.py. They quantify "
                    "how learnable the simulator is. They are not clinical "
                    "validation and must not be reported as patient accuracy."),
        generated=time.strftime("%Y-%m-%d %H:%M"),
        cohort=dict(total=int(a.n), train=len(tr), val=len(va), test=len(te),
                    prevalence=round(float(y.mean()), 4),
                    kl_distribution={str(k): int((kl == k).sum()) for k in range(5)}),
        model=dict(kind="gradient boosted trees (from scratch, ml/gbm.py)",
                   trees=len(m.trees), depth=m.p["depth"], lr=m.p["lr"],
                   n_features=len(names)),
        test=dict(auc=round(auc, 4), brier=round(brier(y[te], p_te), 4)),
        bands=dict(low=low_cut, refer=refer_cut),
        operating_points=dict(refer=at_refer, low=at_low),
        threshold_sweep=[at_threshold(y[te], p_te, t) for t in np.linspace(0.05, 0.9, 18)],
        roc=[[round(float(at_threshold(y[te], p_te, t)["specificity"]), 4),
              round(float(at_threshold(y[te], p_te, t)["sensitivity"]), 4)]
             for t in np.linspace(0.005, 0.995, 120)],
        calibration=calibration_bins(y[te], p_te),
        importances=importances,
        ablation=ablation,
        feature_stats=[dict(feature=names[i],
                            neg_mean=round(float(X[y == 0][:, i].mean()), 3),
                            pos_mean=round(float(X[y == 1][:, i].mean()), 3),
                            neg_sd=round(float(X[y == 0][:, i].std()), 3),
                            pos_sd=round(float(X[y == 1][:, i].std()), 3))
                       for i in range(len(names))],
    )
    json.dump(metrics, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)

    # ---- scored registry for the dashboard --------------------------------
    rng = np.random.default_rng(7)
    w = np.array([d["pop"] for d in DISTRICTS], dtype=float)
    w = w / w.sum()
    n_reg = min(len(te), 2400)
    sel = te[:n_reg]
    p_reg = m.predict_proba(X[sel])
    records = []
    for k, i in enumerate(sel):
        d = DISTRICTS[int(rng.choice(len(DISTRICTS), p=w))]
        sexf = X[i][names.index("sex_f")] > 0.5
        pool = FIRST_NAMES_F if sexf else FIRST_NAMES_M
        pr = float(p_reg[k])
        band = "refer" if pr >= refer_cut else ("watch" if pr >= low_cut else "low")
        day = int(rng.integers(0, 84))
        records.append(dict(
            id=f"SDH-{100000+int(i)}",
            name=f"{pool[int(rng.integers(0,len(pool)))]} {SURNAMES[int(rng.integers(0,len(SURNAMES)))]}",
            district=d["id"], state=d["state"],
            age=round(float(X[i][names.index("age")]), 0),
            sex="F" if sexf else "M",
            bmi=round(float(X[i][names.index("bmi")]), 1),
            occupation=occ[int(i)],
            womac_pain=round(float(X[i][names.index("womac_pain")]), 1),
            risk=round(pr, 4), band=band,
            kl_truth=int(kl[i]),
            days_ago=day,
            synced=bool(rng.random() > 0.06),
            followed_up=bool(band == "refer" and rng.random() > 0.42),
            features={names[j]: round(float(X[i][j]), 4) for j in range(len(names))},
        ))
    json.dump(dict(
        disclaimer="Synthetic registry. Names, districts and dates are generated; "
                   "risk scores are real model output on synthetic signals.",
        bands=dict(low=low_cut, refer=refer_cut),
        districts=DISTRICTS, records=records),
        open(os.path.join(OUT, "cohort.json"), "w"), separators=(",", ":"))

    # ---- parity fixtures for the TypeScript port --------------------------
    fx = []
    prng = np.random.default_rng(999)
    for _ in range(6):
        subj = S.sample_subject(prng)
        sess = S.synth_session(prng, subj)
        feats = F.extract(sess, subj)
        fx.append(dict(
            intake={k: subj[k] for k in F.INTAKE_FEATURES},
            # Full double precision on purpose: rounding the fixture to 6 dp
            # perturbs a feature by ~1e-5, which is enough to flip a sample
            # sitting near a split threshold and make the parity test report a
            # divergence that does not exist in the real pipeline.
            walk={k: [float(v) for v in sess["walk"][k]]
                  for k in ("knee_angle", "shank_gyro", "thigh_gyro", "shank_acc")},
            sts={k: [float(v) for v in sess["sts"][k]]
                 for k in ("thigh_gyro", "trunk_gyro")},
            expected={k: float(v) for k, v in feats.items()},
            expected_risk=float(m.predict_proba(F.to_vector(feats)[None, :])[0]),
            expected_contrib=[float(v) for v in m.contributions(F.to_vector(feats))[0]],
            expected_bias=float(m.contributions(F.to_vector(feats))[1]),
        ))
    json.dump(dict(fs_imu=S.FS_IMU, cases=fx),
              open(os.path.join(OUT, "parity.json"), "w"), separators=(",", ":"))

    for f in ("model.json", "metrics.json", "cohort.json", "parity.json"):
        print(f"  wrote out/{f}  ({os.path.getsize(os.path.join(OUT,f))/1024:.0f} KB)")
    print("=" * 62)
    print("  Reminder: synthetic cohort. Not clinical validation.")


if __name__ == "__main__":
    main()
