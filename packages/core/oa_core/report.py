"""Renders the screening report a health worker actually reads.

Never surfaces a bare probability. Every line is either a measured value with its
unit, a named risk indicator, or an action. The disclaimer is not optional and is
rendered in the patient's own locale.
"""
from __future__ import annotations

import textwrap

from .i18n import t
from .schema import Assessment, RiskResult

W = 62


def _line(ch: str = "-") -> str:
    return ch * W


def _kv(label: str, value: str) -> str:
    return f"{label:<26} {value}"


def _band_label(result: RiskResult, locale: str) -> str:
    return t(f"band.{result.band.value}", locale).upper()


def _mobility_word(result: RiskResult, locale: str) -> str:
    s = result.domain_scores.get("joint", 0.0)
    key = "severe" if s >= 66 else "moderate" if s >= 33 else "mild"
    return t(f"mobility.{key}", locale)


def render_text(a: Assessment, r: RiskResult, locale: str | None = None) -> str:
    loc = locale or a.locale
    g, j = a.gait, a.joint
    sym = max(g.stance_asym_pct, g.step_length_asym_pct)
    out: list[str] = [
        _line("="),
        t("report.title", loc).center(W),
        _line("="),
        "",
        _kv(t("report.patient_id", loc) + ":", a.patient.patient_id),
        _kv(t("report.age", loc) + ":", f"{a.patient.age}   BMI {a.patient.bmi}"),
        _kv(t("report.sex", loc) + ":", a.patient.sex.value),
        "",
        _kv(t("report.pain_score", loc) + ":", f"{a.questionnaire.womac_pain_100:.0f}/100"),
        _kv(t("report.mobility", loc) + ":", _mobility_word(r, loc)),
        _kv(t("report.gait_symmetry", loc) + ":",
            f"{max(0.0, 100.0 - sym):.0f}%" if g.source != "synthetic" or sym else t("report.not_captured", loc)),
        _kv(t("report.knee_rom", loc) + ":",
            f"L {j.knee_rom_l:.0f}° / R {j.knee_rom_r:.0f}°"
            if (j.knee_rom_l or j.knee_rom_r) else t("report.not_captured", loc)),
        _kv(t("report.posture", loc) + ":",
            f"trunk lean {a.posture.trunk_lean_deg + 0.0:.0f}°".replace("-0°", "0°")),
        _kv(t("report.coverage", loc) + ":", f"{r.capture_quality * 100:.0f}%"),
        "",
        f"{t('report.assessment', loc)}:",
        f"        {_band_label(r, loc)}   (index {r.score_0_100:.0f}/100)",
        "",
    ]
    if r.disagreement:
        out.append("  " + t("report.disagreement", loc))
    elif r.model_escalated:
        out.append("  " + t("report.model_escalated", loc))
        out.append("")
    if r.indicators:
        out.append(f"{t('report.indicators', loc)}:")
        for i in r.indicators[:8]:
            out.append(f"  [{i.domain[:4]}] {i.label} - {i.value}")
        if len(r.indicators) > 8:
            out.append(f"  ... +{len(r.indicators) - 8} more")
        out.append("")
    out.append(f"{t('report.recommendation', loc)}:")
    out += [f"  -> {x}" for x in r.recommendations]
    out.append("")
    out += [f"  * {t(k, loc)}" for k in r.guidance_keys]
    note = textwrap.fill("NOTE: " + t("disclaimer.not_a_diagnosis", loc), width=W)
    out += ["", _line(), note,
            f"model: {r.model_version}", _line()]
    return "\n".join(out)


def render_dict(a: Assessment, r: RiskResult, locale: str | None = None) -> dict:
    loc = locale or a.locale
    return {
        "assessment_id": a.assessment_id,
        "patient_id": a.patient.patient_id,
        "captured_at": a.captured_at.isoformat(),
        "locale": loc,
        "band": r.band.value,
        "band_label": t(f"band.{r.band.value}", loc),
        "score_0_100": r.score_0_100,
        "rule_score_0_100": r.rule_score_0_100,
        "ml_probability": r.ml_probability,
        "domain_scores": r.domain_scores,
        "capture_quality": r.capture_quality,
        "needs_referral": r.needs_referral,
        "indicators": [i.model_dump() for i in r.indicators],
        "recommendations": r.recommendations,
        "guidance": [t(k, loc) for k in r.guidance_keys],
        "disclaimer": t("disclaimer.not_a_diagnosis", loc),
        "model_version": r.model_version,
    }
