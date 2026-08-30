"""Preventive-guidance selection (PS: awareness + preventive guidance).

Guidance is chosen from what the assessment actually found, never generic.
It is lifestyle/self-care advice only - no drug, dose or treatment plan - so the
tool stays inside 'screening + awareness' and well out of prescribing.
"""
from __future__ import annotations

from .rules import T
from .schema import Assessment, RiskBand


def guidance_keys(a: Assessment, band: RiskBand) -> list[str]:
    keys: list[str] = []
    q = a.questionnaire
    if a.patient.bmi >= T["bmi_overweight"]:
        keys.append("guidance.weight")
    keys.append("guidance.activity")
    if q.difficulty_squatting >= 2 or q.occupational_load >= 2:
        keys.append("guidance.avoid_squat")
    if q.daily_stair_or_slope_climbs >= 20 or q.occupational_load >= 2:
        keys.append("guidance.slope_load")
    if band is not RiskBand.low:
        keys.append("guidance.footwear")
    if q.stiffness_morning >= 2:
        keys.append("guidance.warmth")
    keys.append("guidance.nutrition")
    seen: set[str] = set()
    return [k for k in keys if not (k in seen or seen.add(k))]


def recommendation_keys(a: Assessment, band: RiskBand, nice_pattern: bool) -> list[str]:
    keys: list[str] = []
    if band is RiskBand.high:
        keys += ["rec.refer_specialist", "rec.clinical_eval"]
    elif band is RiskBand.moderate:
        keys += ["rec.refer_phc", "rec.clinical_eval"] if nice_pattern else ["rec.refer_phc"]
    else:
        keys += ["rec.recheck_6m"]
    if a.questionnaire.swelling_past_month:
        keys.insert(0, "rec.urgent_swelling")
    return keys
