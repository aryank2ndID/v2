"""Orchestrator: Assessment -> RiskResult.

Fusion policy (deliberate, and defend it this way to judges):
  * The rule engine is primary and always runs. It cannot fail closed.
  * The ML head, when a trained model is present, contributes 40% of the score.
  * The printed band is derived from the fused index, through the same cut points
    the rule score uses. One number, one band - a report that says "index 28/100"
    beside "HIGH RISK" is not defensible, and an earlier higher-band-wins rule
    produced exactly that.
  * The model may still escalate, by at most one band, and only above its
    escalation cut (see model.train: the point where it is selective enough for
    acting on it to mean something). A screening tool's expensive error is a
    missed case, so the model gets a voice - but a low, fully-auditable rule
    score can never print HIGH on the strength of a probability alone.
  * The model never de-escalates. The rule engine is the part a clinician can
    check line by line, so it sets the floor.
  * Missing modalities never lower the band - they only reduce `capture_quality`,
    which is printed on the report so the reviewing clinician knows what the
    number is based on.
"""
from __future__ import annotations

import uuid

from . import features, guidance, rules
from .i18n import t
from .model import OARiskModel
from .schema import Assessment, RiskBand, RiskResult

_BAND_ORDER = {RiskBand.low: 0, RiskBand.moderate: 1, RiskBand.high: 2}

RULE_WEIGHT = 0.6
ML_WEIGHT = 0.4


_ORDERED = [RiskBand.low, RiskBand.moderate, RiskBand.high]


def _band_from_probability(p: float, threshold: float) -> RiskBand:
    """The model's own opinion, on the screening cut. Used only for the
    disagreement flag - see the module docstring for why it is not the band."""
    if p >= threshold:
        return RiskBand.high
    if p >= threshold * 0.6:
        return RiskBand.moderate
    return RiskBand.low


def _escalate(band: RiskBand, steps: int = 1) -> RiskBand:
    return _ORDERED[min(len(_ORDERED) - 1, _BAND_ORDER[band] + steps)]


def assess(a: Assessment, model: OARiskModel | None = None,
           locale: str | None = None) -> RiskResult:
    locale = locale or a.locale
    outcome = rules.evaluate(a)
    rule_band = rules.band_for(outcome.score_0_100)

    prob = None
    band = rule_band
    score = outcome.score_0_100
    disagreement = False
    escalated = False
    version = "rules-0.1.0"

    if model is not None and model.available:
        prob = model.probability(features.to_vector(a))
        if prob is not None:
            score = round(RULE_WEIGHT * outcome.score_0_100 + ML_WEIGHT * 100.0 * prob, 1)
            ml_band = _band_from_probability(prob, model.threshold)
            band = rules.band_for(score)
            if prob >= model.escalate_threshold:
                band = max(band, _escalate(rule_band), key=lambda b: _BAND_ORDER[b])
            band = max(band, rule_band, key=lambda b: _BAND_ORDER[b])
            escalated = _BAND_ORDER[band] > _BAND_ORDER[rules.band_for(score)]
            # Only a real conflict is worth alarming the reader with. The screening
            # head fires on most of the cohort by design, so `ml_band != band` would
            # light up on two thirds of healthy people and be ignored within a day.
            disagreement = ((prob >= model.escalate_threshold and band is RiskBand.low)
                            or (prob < model.threshold and band is RiskBand.high))
            version = f"rules-0.1.0+{model.version}"

    rec_keys = guidance.recommendation_keys(a, band, outcome.nice_clinical_pattern)
    gui_keys = guidance.guidance_keys(a, band)
    coverage = features.modality_coverage(a)

    return RiskResult(
        band=band,
        score_0_100=score,
        rule_score_0_100=outcome.score_0_100,
        ml_probability=None if prob is None else round(prob, 4),
        domain_scores=outcome.domain_scores,
        indicators=outcome.indicators,
        recommendations=[t(k, locale) for k in rec_keys],
        guidance_keys=gui_keys,
        needs_referral=band is not RiskBand.low,
        disagreement=disagreement,
        model_escalated=escalated,
        capture_quality=coverage,
        model_version=version,
    )


def new_assessment_id() -> str:
    return f"as-{uuid.uuid4().hex[:12]}"
