"""
SANDHI — feature extraction.

Signals in, 27 numbers out. This module is the contract between the kit and the
model, and it is mirrored in TypeScript at web/lib/dsp/features.ts so inference
on the phone gives the same answer as training on the laptop.
tools/parity_check.mjs proves the two agree.

The contract is gait + sit-to-stand + intake. The piezo/vibroarthrography
(crepitus) channel is intentionally NOT part of the model: the physical kit's
piezo was never brought up to sample, so acoustic features were dropped to keep
every deployed port aligned with a model the real hardware can actually feed.

Nothing here sees the label. Everything is computed from the waveform.
"""
import numpy as np

# ---- ordered feature contract. DO NOT REORDER; the exported model indexes it.
FEATURE_NAMES = [
    # gait — 30 s level walk
    "cadence_spm", "stride_time_s", "stride_time_cv_pct", "stance_pct",
    "double_support_pct", "knee_flex_rom_deg", "swing_peak_flex_deg",
    "shank_swing_peak_dps", "heelstrike_impact_g", "step_asym_pct",
    "gait_speed_est_mps",
    # sit-to-stand — 5 reps
    "sts_total_s", "sts_mean_rep_s", "sts_peak_angvel_dps",
    "sts_smoothness_ldlj", "sts_rep_cv_pct", "sts_trunk_lean_dps",
    # intake — asked by the ASHA worker
    "age", "sex_f", "bmi", "occ_squat_load", "stairs_per_day",
    "terrain_slope_idx", "prior_injury", "family_hx",
    "womac_pain", "womac_stiff",
]

INTAKE_FEATURES = [
    "age", "sex_f", "bmi", "occ_squat_load", "stairs_per_day",
    "terrain_slope_idx", "prior_injury", "family_hx", "womac_pain", "womac_stiff",
]


def _find_peaks(x, min_dist, height):
    """Minimal peak picker — no scipy, so the TS port stays a 1:1 translation."""
    idx = []
    last = -10 ** 9
    for i in range(1, len(x) - 1):
        if x[i] > height and x[i] >= x[i - 1] and x[i] > x[i + 1]:
            if i - last >= min_dist:
                idx.append(i)
                last = i
            elif idx and x[i] > x[idx[-1]]:
                idx[-1] = i
                last = i
    return np.array(idx, dtype=int)


def _refine(x, idx):
    """Parabolic sub-sample interpolation of peak locations.

    Without this, stride time is quantised to the 10 ms IMU period and the
    quantisation noise swamps the true stride-to-stride variability we care
    about (healthy CV is only ~2%).
    """
    out = []
    for i in idx:
        if i <= 0 or i >= len(x) - 1:
            out.append(float(i))
            continue
        a, b, c = float(x[i - 1]), float(x[i]), float(x[i + 1])
        den = a - 2.0 * b + c
        out.append(float(i) + (0.5 * (a - c) / den if abs(den) > 1e-12 else 0.0))
    return np.array(out, dtype=float)


def _cv_pct(v):
    v = np.asarray(v, dtype=float)
    if len(v) < 2 or np.mean(v) == 0:
        return 0.0
    return float(100.0 * np.std(v) / np.mean(v))


# ------------------------------------------------------------------- gait ---

def gait_features(walk):
    fs = walk["fs"]
    knee = np.asarray(walk["knee_angle"], dtype=float)
    sg = np.asarray(walk["shank_gyro"], dtype=float)
    acc = np.asarray(walk["shank_acc"], dtype=float)

    # Mid-swing shank velocity peaks are the most robust stride landmark.
    thr = 0.42 * float(np.percentile(sg, 99))
    pk = _find_peaks(sg, int(0.45 * fs), max(thr, 40.0))

    if len(pk) >= 3:
        stride_s = np.diff(_refine(sg, pk)) / fs
        stride_s = stride_s[(stride_s > 0.55) & (stride_s < 2.6)]
    else:
        stride_s = np.array([1.1])
    if len(stride_s) == 0:
        stride_s = np.array([1.1])

    stride_time = float(np.median(stride_s))
    cadence = 120.0 / stride_time                       # two steps per stride
    # Within-limb CV: pooling both limbs folds asymmetry into variability.
    if len(stride_s) >= 6:
        stride_cv = 0.5 * (_cv_pct(stride_s[0::2]) + _cv_pct(stride_s[1::2]))
    else:
        stride_cv = _cv_pct(stride_s)

    # Left/right asymmetry: alternate strides belong to alternate limbs.
    if len(stride_s) >= 4:
        a, b = stride_s[0::2], stride_s[1::2]
        m = min(len(a), len(b))
        num = abs(float(np.mean(a[:m])) - float(np.mean(b[:m])))
        den = 0.5 * (float(np.mean(a[:m])) + float(np.mean(b[:m])))
        step_asym = float(100.0 * num / den) if den else 0.0
    else:
        step_asym = 0.0

    # Heel strikes: impact transients on the shank accelerometer.
    acc_hp = acc - np.convolve(acc, np.ones(9) / 9, mode="same")
    hs = _find_peaks(acc_hp, int(0.42 * fs), 0.35 * float(np.percentile(acc_hp, 99)))
    impact = float(np.median(acc_hp[hs])) if len(hs) else 0.0

    # Stance/swing split from the shank velocity profile.
    swing_pct = float(100.0 * np.mean(sg > (0.12 * float(np.percentile(sg, 98)))))
    stance_pct = float(np.clip(100.0 - swing_pct, 52.0, 78.0))
    double_support = float(np.clip(2.0 * (stance_pct - 50.0), 8.0, 40.0))

    # Knee kinematics.
    kpk = _find_peaks(knee, int(0.45 * fs), float(np.percentile(knee, 75)))
    swing_peak = float(np.median(knee[kpk])) if len(kpk) else float(np.max(knee))
    rom = float(np.percentile(knee, 98) - np.percentile(knee, 2))

    # Speed proxy: step length scales with swing velocity and knee excursion.
    shank_peak = float(np.median(sg[pk])) if len(pk) else float(np.max(sg))
    step_len = 0.00118 * shank_peak + 0.0022 * swing_peak
    speed = float(np.clip(step_len * (cadence / 60.0), 0.15, 2.2))

    return {
        "cadence_spm": cadence,
        "stride_time_s": stride_time,
        "stride_time_cv_pct": stride_cv,
        "stance_pct": stance_pct,
        "double_support_pct": double_support,
        "knee_flex_rom_deg": rom,
        "swing_peak_flex_deg": swing_peak,
        "shank_swing_peak_dps": shank_peak,
        "heelstrike_impact_g": impact,
        "step_asym_pct": step_asym,
        "gait_speed_est_mps": speed,
        "_n_strides": int(len(stride_s)),
    }


# ----------------------------------------------------------- sit-to-stand ---

def sts_features(sts):
    fs = sts["fs"]
    th = np.asarray(sts["thigh_gyro"], dtype=float)
    tr = np.asarray(sts["trunk_gyro"], dtype=float)

    pk = _find_peaks(th, int(0.7 * fs), 0.40 * float(np.percentile(th, 99)))
    if len(pk) >= 2:
        reps = np.diff(pk) / fs
        total = float((pk[-1] - pk[0]) / fs) * (len(pk) / max(1.0, len(pk) - 1.0))
    else:
        reps = np.array([2.0])
        total = 10.0
    mean_rep = float(np.mean(reps))
    rep_cv = _cv_pct(reps)
    peak_av = float(np.median(th[pk])) if len(pk) else float(np.max(th))

    # Log dimensionless jerk — the standard smoothness metric for STS.
    seg = th[pk[0]:pk[-1]] if len(pk) >= 2 else th
    if len(seg) < 8:
        seg = th
    jerk = np.diff(seg) * fs
    dur = len(seg) / fs
    peak_v = max(1e-6, float(np.max(np.abs(seg))))
    dlj = (dur ** 3 / peak_v ** 2) * float(np.sum(jerk ** 2)) / fs
    ldlj = -float(np.log(max(dlj, 1e-12)))

    return {
        "sts_total_s": float(np.clip(total, 3.0, 60.0)),
        "sts_mean_rep_s": mean_rep,
        "sts_peak_angvel_dps": peak_av,
        "sts_smoothness_ldlj": ldlj,
        "sts_rep_cv_pct": rep_cv,
        "sts_trunk_lean_dps": float(np.percentile(tr, 98)),
        "_n_reps": int(len(pk)),
    }


# ------------------------------------------------------------------ join ----

def extract(session, intake):
    f = {}
    for src in (gait_features(session["walk"]), sts_features(session["sts"])):
        f.update({k: v for k, v in src.items() if not k.startswith("_")})
    for k in INTAKE_FEATURES:
        f[k] = float(intake[k])
    return f


def to_vector(f):
    return np.array([float(f[n]) for n in FEATURE_NAMES], dtype=float)
