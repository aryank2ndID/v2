"""The rule engine is the part a clinician audits line by line, so it is the part
with the most tests. Every rule must be reachable, sourced, and non-fatal."""
import pytest


@pytest.fixture
def blank():
    from oa_core.schema import (Assessment, GaitFeatures, JointFeatures, Patient,
                                PostureFeatures, Questionnaire)
    return Assessment(assessment_id="as-test000000", patient=Patient(
        patient_id="NER-TEST", age=30, sex="female", height_cm=160, weight_kg=55),
        questionnaire=Questionnaire(), gait=GaitFeatures(), joint=JointFeatures(),
        posture=PostureFeatures())


def test_every_rule_carries_evidence_and_a_weight():
    from oa_core import rules
    assert len(rules.RULES) >= 20
    ids = [r.code for r in rules.RULES]
    assert len(ids) == len(set(ids)), "duplicate rule ids"
    for r in rules.RULES:
        assert r.weight > 0 and r.domain and r.label and r.source


def test_total_max_matches_the_declared_weights():
    """The 0-100 index divides by this; if it drifts the printed score is wrong."""
    from oa_core import rules
    assert rules.TOTAL_MAX == sum(r.weight for r in rules.RULES)


def test_band_cut_points_are_ordered_and_cover_the_range():
    from oa_core import rules
    from oa_core.schema import RiskBand
    assert rules.T["band_moderate"] < rules.T["band_high"]
    assert rules.band_for(0) is RiskBand.low
    assert rules.band_for(rules.T["band_moderate"]) is RiskBand.moderate
    assert rules.band_for(rules.T["band_high"]) is RiskBand.high
    assert rules.band_for(100) is RiskBand.high


def test_an_empty_assessment_scores_low_and_does_not_crash(blank):
    """A camp will produce half-filled records. Zero measures must mean zero
    evidence, never a spuriously high score from a 0 that reads as 'reduced'."""
    from oa_core import rules
    from oa_core.schema import RiskBand
    out = rules.evaluate(blank)
    assert rules.band_for(out.score_0_100) is RiskBand.low
    assert out.score_0_100 < rules.T["band_moderate"]


def test_a_clearly_symptomatic_case_reaches_high(blank):
    from oa_core import rules
    from oa_core.schema import RiskBand
    a = blank.model_copy(update={
        "patient": blank.patient.model_copy(update={"age": 58, "weight_kg": 78.0}),
        "questionnaire": blank.questionnaire.model_copy(update={
            "pain_walking": 3, "pain_stairs": 3, "pain_at_night": 2, "pain_standing": 3,
            "stiffness_morning": 3, "stiffness_duration_min": 25,
            "difficulty_stairs_down": 3, "difficulty_squatting": 4,
            "difficulty_rising_from_sitting": 3, "crepitus": True,
            "occupational_load": 2, "pain_years": 3.0}),
        "joint": blank.joint.model_copy(update={
            "knee_flex_max_l": 95.0, "knee_ext_deficit_l": 8.0, "knee_flex_max_r": 120.0,
            "sts5_time_s": 19.0, "tug_time_s": 14.0, "varus_valgus_deg_l": -9.0}),
    })
    out = rules.evaluate(a)
    assert rules.band_for(out.score_0_100) is RiskBand.high
    assert out.nice_clinical_pattern is True
    assert len(out.indicators) >= 8


def test_score_is_monotone_in_added_findings(blank):
    """Adding a positive finding must never lower the index."""
    from oa_core import rules
    base = rules.evaluate(blank).score_0_100
    worse = rules.evaluate(blank.model_copy(update={
        "questionnaire": blank.questionnaire.model_copy(
            update={"crepitus": True, "prior_knee_injury": True})})).score_0_100
    assert worse > base


def test_a_predicate_that_raises_is_contained(blank, monkeypatch):
    """One broken rule must not take down a screening camp."""
    from oa_core import rules

    def boom(_a):
        raise ZeroDivisionError("synthetic fault")

    bad = rules.Rule(code="BOOM", domain="gait", label="fault injection", weight=5,
                     test=boom, render=lambda a: "", source="test")
    monkeypatch.setattr(rules, "RULES", [*rules.RULES, bad])
    out = rules.evaluate(blank)
    assert "BOOM" not in {i.code for i in out.indicators}


def test_domain_scores_are_percentages(blank):
    from oa_core import rules
    out = rules.evaluate(blank)
    assert set(out.domain_scores) >= {"symptom", "gait", "joint"}
    assert all(0.0 <= v <= 100.0 for v in out.domain_scores.values())
