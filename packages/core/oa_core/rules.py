"""Interpretable rule engine: the auditable baseline that ships next to the ML model.

Every threshold is a NAMED CONSTANT with an `evidence` note and a `source` slot.
Two reasons this exists:
  1. A rural health worker (and an SIH judge) can be shown *why* a case was
     flagged. A gradient-boosted probability alone is not defensible.
  2. It gives the ML model something to be compared against. If the two disagree
     the report says so instead of silently trusting the model.

`source` strings are placeholders the team must replace with the exact citation
used in the final report. The curated reference list lives in
`docs/research.md` (§ 3, Peer-Reviewed References); until a rule is tied to one
of those by number, keep `source` at "TODO: cite" — never present it as
validated. Do NOT present these cutoffs as validated until the dataset-fitted
values from scripts/fit_thresholds.py replace them.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from .schema import Assessment, Indicator, RiskBand

# --- tunable thresholds ---------------------------------------------------- #
T = {
    "age_clinical": 45,             # NICE: consider clinical knee OA at >=45 y
    "stiffness_short_min": 30,      # NICE: morning stiffness <=30 min pattern
    "womac_pain_flag": 30.0,        # normalised 0-100
    "womac_function_flag": 30.0,
    "bmi_overweight": 25.0,
    "bmi_obese": 30.0,
    "knee_flex_low": 120.0,         # deg; functional squat/floor-sit needs ~120-130
    "knee_ext_deficit": 5.0,        # deg lag = capsular/effusion pattern
    "knee_rom_gait_low": 45.0,      # deg swing-phase excursion in normal gait
    "asym_pct_flag": 10.0,          # Robinson SI; >10% commonly treated as abnormal
    "stance_asym_pct_flag": 15.0,   # stance SI is noisier than step SI - higher bar
    "gait_speed_low_norm": 1.0,     # leg-lengths/s (~1.0 m/s in adults of this height)
    "stride_cv_high": 5.0,          # % stride-time variability
    "sts5_slow_s": 15.0,            # five-times sit-to-stand
    "tug_slow_s": 12.0,             # timed up-and-go; >12 s = mobility impairment
    "varus_valgus_flag": 8.0,       # deg frontal-plane malalignment
    "trunk_lean_flag": 8.0,         # deg
    "pain_years_chronic": 1.0,
    "band_moderate": 25.0,
    "band_high": 50.0,
}


@dataclass
class Rule:
    code: str
    domain: str
    label: str
    weight: float
    test: Callable[[Assessment], bool]
    render: Callable[[Assessment], str]
    evidence: str = ""
    source: str = "TODO: cite"


def _q(a: Assessment):
    return a.questionnaire


RULES: list[Rule] = [
    # ---------------- symptom domain ---------------- #
    Rule("SYM_PAIN", "symptom", "Activity-related joint pain", 14,
         lambda a: _q(a).womac_pain_100 >= T["womac_pain_flag"],
         lambda a: f"pain index {_q(a).womac_pain_100:.0f}/100",
         "Activity-related pain is the cardinal OA symptom.", "NICE NG226"),
    Rule("SYM_FUNC", "symptom", "Functional limitation", 10,
         lambda a: _q(a).womac_function_100 >= T["womac_function_flag"],
         lambda a: f"function index {_q(a).womac_function_100:.0f}/100",
         "Difficulty with stairs/rising/squatting tracks OA severity.", "WOMAC construct"),
    Rule("SYM_STIFF", "symptom", "Short-duration morning stiffness", 8,
         lambda a: _q(a).stiffness_morning >= 2
         and _q(a).stiffness_duration_min <= T["stiffness_short_min"],
         lambda a: f"{_q(a).stiffness_duration_min} min on waking",
         "<=30 min separates OA from inflammatory arthritis.", "NICE NG226"),
    Rule("SYM_CHRONIC", "symptom", "Symptoms persisting > 1 year", 5,
         lambda a: _q(a).pain_years >= T["pain_years_chronic"],
         lambda a: f"{_q(a).pain_years:.1f} years",
         "Chronicity raises structural-disease probability.", "TODO: cite"),
    Rule("SYM_CREPITUS", "symptom", "Crepitus reported", 5,
         lambda a: _q(a).crepitus, lambda a: "present",
         "Crepitus is part of the ACR clinical criteria.", "ACR 1986 knee criteria"),
    Rule("SYM_SWELL", "symptom", "Recent joint swelling", 4,
         lambda a: _q(a).swelling_past_month, lambda a: "past month",
         "Effusion suggests active joint pathology - refer.", "TODO: cite"),
    # ---------------- covariates ---------------- #
    Rule("COV_AGE", "covariate", f"Age >= {T['age_clinical']}", 8,
         lambda a: a.patient.age >= T["age_clinical"],
         lambda a: f"{a.patient.age} y",
         "Strongest non-modifiable OA risk factor.", "NICE NG226"),
    Rule("COV_BMI", "covariate", "Elevated BMI", 8,
         lambda a: a.patient.bmi >= T["bmi_overweight"],
         lambda a: f"BMI {a.patient.bmi}",
         "Dose-dependent mechanical + metabolic load on the knee.", "TODO: cite"),
    Rule("COV_INJURY", "covariate", "Prior knee injury or surgery", 8,
         lambda a: _q(a).prior_knee_injury or _q(a).prior_knee_surgery,
         lambda a: "reported",
         "Post-traumatic OA is a distinct, high-risk pathway.", "TODO: cite"),
    Rule("COV_LOAD", "covariate", "High occupational joint loading", 6,
         lambda a: _q(a).occupational_load >= 2
         or _q(a).daily_stair_or_slope_climbs >= 30,
         lambda a: f"load class {_q(a).occupational_load}, "
                   f"{_q(a).daily_stair_or_slope_climbs} climbs/day",
         "Squatting/kneeling/slope work is prevalent in NER hill districts.",
         "TODO: cite occupational OA study"),
    Rule("COV_FAMILY", "covariate", "Family history", 3,
         lambda a: _q(a).family_history_oa, lambda a: "positive",
         "Heritable component of knee/hip OA.", "TODO: cite"),
    # ---------------- joint / ROM domain ---------------- #
    Rule("JNT_FLEX", "joint", "Reduced peak knee flexion", 12,
         lambda a: 0 < min(a.joint.knee_flex_max_l, a.joint.knee_flex_max_r)
         < T["knee_flex_low"],
         lambda a: f"{min(a.joint.knee_flex_max_l, a.joint.knee_flex_max_r):.0f} deg worst side",
         "Loss of terminal flexion is an early OA finding.", "TODO: cite"),
    Rule("JNT_EXT", "joint", "Extension lag", 10,
         lambda a: max(a.joint.knee_ext_deficit_l, a.joint.knee_ext_deficit_r)
         >= T["knee_ext_deficit"],
         lambda a: f"{max(a.joint.knee_ext_deficit_l, a.joint.knee_ext_deficit_r):.0f} deg lag",
         "Fixed-flexion deformity accompanies joint-space narrowing.", "TODO: cite"),
    Rule("JNT_STS", "joint", "Slow five-times sit-to-stand", 8,
         lambda a: a.joint.sts5_time_s >= T["sts5_slow_s"],
         lambda a: f"{a.joint.sts5_time_s:.1f} s",
         "Lower-limb power deficit; OARSI performance measure.", "OARSI set"),
    Rule("JNT_TUG", "joint", "Slow timed up-and-go", 6,
         lambda a: a.joint.tug_time_s >= T["tug_slow_s"],
         lambda a: f"{a.joint.tug_time_s:.1f} s",
         ">12 s indicates mobility impairment / fall risk.", "OARSI set"),
    Rule("JNT_ASYM", "joint", "Side-to-side ROM asymmetry", 8,
         lambda a: a.joint.knee_rom_l > 0 and a.joint.knee_rom_r > 0
         and abs(a.joint.knee_rom_l - a.joint.knee_rom_r)
         / max(1e-6, (a.joint.knee_rom_l + a.joint.knee_rom_r) / 2) * 100
         >= T["asym_pct_flag"],
         lambda a: f"L {a.joint.knee_rom_l:.0f} deg vs R {a.joint.knee_rom_r:.0f} deg",
         "Unilateral loss points to a single affected compartment.", "TODO: cite"),
    # ---------------- gait domain ---------------- #
    Rule("GAI_SPEED", "gait", "Reduced walking speed", 10,
         lambda a: 0 < a.gait.gait_speed_norm < T["gait_speed_low_norm"],
         lambda a: f"{a.gait.gait_speed_norm:.2f} leg-lengths/s",
         "Speed is the most reproducible gait marker of joint pain.", "TODO: cite"),
    # Step-length SI is the primary asymmetry measure: on the kinematic
    # synthesiser it reads 0-1% for healthy gait and rises monotonically to ~22%
    # at severity 0.95. Single-limb stance SI carries ~6 pp of noise at 30 fps, so
    # it only counts above 15% instead of being max()-ed in - otherwise camera
    # noise alone would trip the 10% flag on a healthy walker.
    Rule("GAI_ASYM", "gait", "Gait asymmetry", 12,
         lambda a: (a.gait.step_length_asym_pct >= T["asym_pct_flag"]
                    or a.gait.stance_asym_pct >= T["stance_asym_pct_flag"]),
         lambda a: f"step {a.gait.step_length_asym_pct:.0f}% / stance {a.gait.stance_asym_pct:.0f}% SI",
         "Offloading the painful limb shortens its stance and step.", "TODO: cite"),
    Rule("GAI_ROM", "gait", "Reduced knee excursion while walking", 10,
         lambda a: 0 < min(a.gait.knee_rom_gait_l, a.gait.knee_rom_gait_r)
         < T["knee_rom_gait_low"],
         lambda a: f"{min(a.gait.knee_rom_gait_l, a.gait.knee_rom_gait_r):.0f} deg",
         "'Stiff-knee gait' is a classic OA compensation.", "TODO: cite"),
    Rule("GAI_VAR", "gait", "High stride-time variability", 6,
         lambda a: a.gait.stride_time_cv_pct >= T["stride_cv_high"],
         lambda a: f"CV {a.gait.stride_time_cv_pct:.1f}%",
         "Irregular stepping reflects pain avoidance / instability.", "TODO: cite"),
    # ---------------- posture domain ---------------- #
    Rule("POS_ALIGN", "posture", "Frontal-plane knee malalignment", 10,
         lambda a: max(abs(a.joint.varus_valgus_deg_l), abs(a.joint.varus_valgus_deg_r))
         >= T["varus_valgus_flag"],
         lambda a: f"{max(abs(a.joint.varus_valgus_deg_l), abs(a.joint.varus_valgus_deg_r)):.0f} deg",
         "Varus/valgus concentrates load on one compartment.", "TODO: cite"),
    Rule("POS_TRUNK", "posture", "Compensatory trunk lean", 5,
         lambda a: abs(a.posture.trunk_lean_deg) >= T["trunk_lean_flag"],
         lambda a: f"{a.posture.trunk_lean_deg:.0f} deg",
         "Lateral trunk lean reduces knee adduction moment.", "TODO: cite"),
]

DOMAIN_MAX: dict[str, float] = {}
for _r in RULES:
    DOMAIN_MAX[_r.domain] = DOMAIN_MAX.get(_r.domain, 0.0) + _r.weight
TOTAL_MAX = sum(r.weight for r in RULES)


@dataclass
class RuleOutcome:
    score_0_100: float
    domain_scores: dict[str, float]
    indicators: list[Indicator] = field(default_factory=list)
    nice_clinical_pattern: bool = False


def nice_clinical_pattern(a: Assessment) -> bool:
    """NICE NG226 pattern: >=45 y + activity-related pain + stiffness <=30 min."""
    q = a.questionnaire
    return (a.patient.age >= T["age_clinical"]
            and max(q.pain_walking, q.pain_stairs, q.pain_standing) >= 2
            and q.stiffness_duration_min <= T["stiffness_short_min"])


def evaluate(a: Assessment) -> RuleOutcome:
    hit_w: dict[str, float] = {}
    inds: list[Indicator] = []
    for r in RULES:
        try:
            fired = bool(r.test(a))
        except Exception:                      # a missing/zero measure must not crash a camp
            fired = False
        if fired:
            hit_w[r.domain] = hit_w.get(r.domain, 0.0) + r.weight
            inds.append(Indicator(code=r.code, label=r.label, value=r.render(a),
                                  domain=r.domain, weight=r.weight))
    domain_scores = {d: round(100.0 * hit_w.get(d, 0.0) / m, 1)
                     for d, m in DOMAIN_MAX.items()}
    total = round(100.0 * sum(hit_w.values()) / TOTAL_MAX, 1)
    inds.sort(key=lambda i: -i.weight)
    return RuleOutcome(total, domain_scores, inds, nice_clinical_pattern(a))


def band_for(score: float) -> RiskBand:
    if score >= T["band_high"]:
        return RiskBand.high
    if score >= T["band_moderate"]:
        return RiskBand.moderate
    return RiskBand.low
