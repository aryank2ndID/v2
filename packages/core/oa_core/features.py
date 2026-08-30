"""Assessment -> flat numeric feature vector.

One ordered list of names, one function. Both the training script and the
on-device ONNX path import from here, so the vector can never drift between
train and serve - the classic way these projects silently break.

Missing-modality handling: a camp with no space for a 6 m walkway still has to
produce a result, so every objective block carries a `has_*` mask flag and its
features are zero-filled when absent. The model sees the mask and learns to
lean on the questionnaire instead.
"""
from __future__ import annotations

import numpy as np

from .schema import Assessment

QUESTIONNAIRE_FEATURES = [
    "age", "sex_female", "bmi",
    "womac_pain", "womac_stiffness", "womac_function",
    "stiffness_duration_min", "pain_years",
    "prior_injury", "prior_surgery", "family_history", "crepitus", "swelling",
    "occupational_load", "daily_climbs", "activity_min_week",
]
GAIT_FEATURES = [
    "has_gait", "gait_quality", "cadence_spm", "gait_speed_norm", "stride_time_s",
    "stride_time_cv_pct", "double_support_pct",
    "stance_asym_pct", "step_length_asym_pct", "knee_rom_asym_pct",
    "knee_rom_gait_worst", "knee_flex_peak_stance_worst",
    "toe_out_worst",
]
JOINT_FEATURES = [
    "has_joint", "knee_flex_max_worst", "knee_ext_deficit_worst",
    "knee_rom_worst", "knee_rom_asym_static_pct", "sts5_time_s", "tug_time_s",
    "varus_valgus_worst",
]
POSTURE_FEATURES = [
    "has_posture", "trunk_lean_abs", "pelvic_obliquity_abs",
    "shoulder_tilt_abs", "sway_area_norm",
]
FEATURE_NAMES: list[str] = (QUESTIONNAIRE_FEATURES + GAIT_FEATURES
                            + JOINT_FEATURES + POSTURE_FEATURES)
N_FEATURES = len(FEATURE_NAMES)


def _si(a: float, b: float) -> float:
    m = (a + b) / 2.0
    return 0.0 if m == 0 else abs(a - b) / m * 100.0


def to_dict(a: Assessment) -> dict[str, float]:
    q, g, j, p = a.questionnaire, a.gait, a.joint, a.posture
    has_gait = float(g.cadence_spm > 0 or g.gait_speed_norm > 0)
    has_joint = float(j.knee_flex_max_l > 0 or j.knee_flex_max_r > 0 or j.sts5_time_s > 0)
    has_posture = float(p.sway_area_norm > 0 or p.trunk_lean_deg != 0)

    d: dict[str, float] = {
        "age": float(a.patient.age),
        "sex_female": float(a.patient.sex.value == "female"),
        "bmi": a.patient.bmi,
        "womac_pain": q.womac_pain_100,
        "womac_stiffness": q.womac_stiffness_100,
        "womac_function": q.womac_function_100,
        "stiffness_duration_min": float(q.stiffness_duration_min),
        "pain_years": float(q.pain_years),
        "prior_injury": float(q.prior_knee_injury),
        "prior_surgery": float(q.prior_knee_surgery),
        "family_history": float(q.family_history_oa),
        "crepitus": float(q.crepitus),
        "swelling": float(q.swelling_past_month),
        "occupational_load": float(q.occupational_load),
        "daily_climbs": float(q.daily_stair_or_slope_climbs),
        "activity_min_week": float(q.activity_min_per_week),

        "has_gait": has_gait,
        "gait_quality": g.quality if has_gait else 0.0,
        "cadence_spm": g.cadence_spm,
        "gait_speed_norm": g.gait_speed_norm,
        "stride_time_s": g.stride_time_s,
        "stride_time_cv_pct": g.stride_time_cv_pct,
        "double_support_pct": g.double_support_pct,
        "stance_asym_pct": g.stance_asym_pct,
        "step_length_asym_pct": g.step_length_asym_pct,
        "knee_rom_asym_pct": g.knee_rom_asym_pct,
        "knee_rom_gait_worst": min(g.knee_rom_gait_l, g.knee_rom_gait_r) if has_gait else 0.0,
        "knee_flex_peak_stance_worst": (min(g.knee_flex_peak_stance_l,
                                            g.knee_flex_peak_stance_r)
                                        if has_gait else 0.0),
        "toe_out_worst": max(abs(g.toe_out_deg_l), abs(g.toe_out_deg_r)),

        "has_joint": has_joint,
        "knee_flex_max_worst": min(j.knee_flex_max_l, j.knee_flex_max_r) if has_joint else 0.0,
        "knee_ext_deficit_worst": max(j.knee_ext_deficit_l, j.knee_ext_deficit_r),
        "knee_rom_worst": min(j.knee_rom_l, j.knee_rom_r) if has_joint else 0.0,
        "knee_rom_asym_static_pct": _si(j.knee_rom_l, j.knee_rom_r),
        "sts5_time_s": j.sts5_time_s,
        "tug_time_s": j.tug_time_s,
        "varus_valgus_worst": max(abs(j.varus_valgus_deg_l), abs(j.varus_valgus_deg_r)),

        "has_posture": has_posture,
        "trunk_lean_abs": abs(p.trunk_lean_deg),
        "pelvic_obliquity_abs": abs(p.pelvic_obliquity_deg),
        "shoulder_tilt_abs": abs(p.shoulder_tilt_deg),
        "sway_area_norm": p.sway_area_norm,
    }
    missing = set(FEATURE_NAMES) - set(d)
    if missing:
        raise KeyError(f"features.to_dict is missing {sorted(missing)}")
    return d


def to_vector(a: Assessment) -> np.ndarray:
    d = to_dict(a)
    return np.array([d[n] for n in FEATURE_NAMES], dtype=np.float32)


def modality_coverage(a: Assessment) -> float:
    """0..1 - how much of the intended assessment was actually captured."""
    d = to_dict(a)
    return round((1.0 + d["has_gait"] + d["has_joint"] + d["has_posture"]) / 4.0, 2)
