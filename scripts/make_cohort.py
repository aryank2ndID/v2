"""Generate a SYNTHETIC screening cohort end-to-end through the real pipeline.

What this is for: exercising and regression-testing the full path
(questionnaire + synthesised walk -> CV extraction -> feature vector -> label)
without waiting on dataset access approvals, and giving the app a realistic
seed database for demos.

What this is NOT for: any claim about accuracy in humans. Every row is stamped
synthetic=1 and the training script propagates that stamp into the model metrics
file, so a synthetic-trained model can never be quietly presented as validated.
Real labels come from the cohorts listed in docs/datasets.md.

    python scripts/make_cohort.py --n 800 --out data/synthetic/cohort.csv
"""
from __future__ import annotations

import argparse
import csv
import json
import time
from pathlib import Path

import numpy as np

import _bootstrap  # noqa: F401
from oa_core import features as F
from oa_core.schema import Assessment, Patient, Questionnaire
from oa_cv import gait, posture, rom
from oa_cv.synth import synthesise, synthesise_frontal, truth_for_severity

SYNTH_VERSION = "synth-cohort-v2"


def _ordinal(x: float, rng: np.random.Generator, noise: float = 0.55) -> int:
    """Map a latent 0..1 burden onto a 0..4 patient-reported item."""
    return int(np.clip(round(x * 4 + rng.normal(0, noise)), 0, 4))


def sample_patient(rng: np.random.Generator, i: int) -> tuple[Patient, float]:
    age = int(np.clip(rng.normal(48, 15), 18, 88))
    sex = rng.choice(["female", "male"], p=[0.58, 0.42])
    height = float(np.clip(rng.normal(157 if sex == "female" else 168, 7), 135, 195))
    bmi_true = float(np.clip(rng.normal(24.5, 4.2), 15.5, 41))
    weight = round(bmi_true * (height / 100) ** 2, 1)
    occ = int(rng.choice([0, 1, 2, 3], p=[0.25, 0.3, 0.3, 0.15]))
    injury = bool(rng.random() < 0.16)
    family = bool(rng.random() < 0.22)

    # latent structural burden: the generative "truth" the model must recover
    logit = (-4.6 + 0.075 * (age - 45) + 0.13 * (bmi_true - 24.5) + 0.42 * occ
             + 1.15 * injury + 0.55 * family + (0.45 if sex == "female" else 0.0)
             + rng.normal(0, 0.9))
    severity = float(np.clip(1 / (1 + np.exp(-logit)) * 1.7 + rng.normal(0, 0.06), 0, 1))
    p = Patient(patient_id=f"NER-{i:05d}", age=age, sex=sex,
                height_cm=round(height, 1), weight_kg=weight,
                district_code=str(rng.choice(["AS-KAM", "ML-EKH", "MN-IMW",
                                              "NL-KOH", "AR-PAP", "TR-WTR"])))
    return p, severity


def sample_questionnaire(severity: float, patient: Patient, occ_load: int,
                         injury: bool, family: bool, rng: np.random.Generator,
                         pain_sensitivity: float = 1.0) -> Questionnaire:
    """Symptoms are NOT a clean readout of structural severity.

    Radiographic and symptomatic knee OA are famously discordant: plenty of KL-2/3
    knees are pain-free and plenty of painful knees look normal on film. If the
    generator ignores that, the questionnaire alone predicts the label perfectly,
    the model looks superb, and the whole exercise measures nothing. `pain_sensitivity`
    is an independent latent that scales reported burden.
    """
    s = float(np.clip(severity * pain_sensitivity, 0, 1))
    return Questionnaire(
        pain_walking=_ordinal(s, rng), pain_stairs=_ordinal(min(1.0, s * 1.2), rng),
        pain_at_night=_ordinal(s * 0.75, rng), pain_sitting=_ordinal(s * 0.6, rng),
        pain_standing=_ordinal(s * 0.85, rng),
        stiffness_morning=_ordinal(s * 0.9, rng), stiffness_later_day=_ordinal(s * 0.6, rng),
        stiffness_duration_min=int(np.clip(rng.normal(8 + 22 * s, 8), 0, 120)),
        difficulty_stairs_down=_ordinal(min(1.0, s * 1.15), rng),
        difficulty_rising_from_sitting=_ordinal(s * 0.95, rng),
        difficulty_standing=_ordinal(s * 0.8, rng),
        difficulty_squatting=_ordinal(min(1.0, s * 1.25), rng),
        difficulty_walking_flat=_ordinal(s * 0.7, rng),
        prior_knee_injury=injury, prior_knee_surgery=bool(injury and rng.random() < 0.2),
        family_history_oa=family, crepitus=bool(rng.random() < 0.15 + 0.6 * s),
        swelling_past_month=bool(rng.random() < 0.05 + 0.35 * s),
        occupational_load=occ_load,
        daily_stair_or_slope_climbs=int(np.clip(rng.normal(12 + 14 * occ_load, 9), 0, 120)),
        activity_min_per_week=int(np.clip(rng.normal(180 - 90 * severity, 70), 0, 900)),
        pain_years=round(float(np.clip(rng.gamma(1.4, 1.6) * severity * 2.2, 0, 25)), 1),
    )


def build_row(i: int, rng: np.random.Generator, full_cv: bool) -> dict:
    patient, severity = sample_patient(rng, i)
    occ = int(rng.choice([0, 1, 2, 3], p=[0.25, 0.3, 0.3, 0.15]))
    injury = bool(rng.random() < 0.16)
    # independent symptom-amplification factor (pain sensitivity, coping, stoicism)
    pain_sensitivity = float(np.clip(rng.lognormal(0.0, 0.45), 0.25, 2.6))
    q = sample_questionnaire(severity, patient, occ, injury,
                            bool(rng.random() < 0.22), rng, pain_sensitivity)
    affected = str(rng.choice(["L", "R"]))
    seed = int(rng.integers(0, 2**31 - 1))

    # some camps cannot capture every modality - reproduce that in the data
    have_gait = rng.random() < 0.88
    have_joint = rng.random() < 0.80
    have_posture = rng.random() < 0.70

    a = Assessment(assessment_id=f"as-{i:06d}", patient=patient, questionnaire=q)
    if full_cv and have_gait:
        seq, _ = synthesise(truth_for_severity(severity, affected, seed), seed=seed)
        a.gait = gait.extract(seq)
        if have_joint:
            a.joint = rom.extract(rom_clips={"L": seq, "R": seq})
    if full_cv and have_posture:
        varus = float(np.clip(rng.normal(-2 - 9 * severity, 3), -25, 10))
        fseq = synthesise_frontal(varus_deg=abs(varus), pelvic_obliq_deg=rng.normal(0, 2.5),
                                  sway_norm=float(np.clip(0.3 + 0.9 * severity, 0, 1.4)),
                                  seed=seed)
        a.posture, align = posture.extract(fseq)
        if have_joint:
            a.joint = a.joint.model_copy(update=align)
    if have_joint:
        a.joint = a.joint.model_copy(update={
            "sts5_time_s": round(float(np.clip(rng.normal(9.5 + 11 * severity, 2.2), 4, 45)), 2),
            "tug_time_s": round(float(np.clip(rng.normal(8.0 + 8 * severity, 1.8), 4, 40)), 2)})

    row = F.to_dict(a)
    # label = structural disease a clinician would confirm, with the ~10% label
    # noise any real chart review carries
    label = int(severity >= 0.35)
    if rng.random() < 0.10:
        label = 1 - label
    row.update(severity=round(severity, 4),
               pain_sensitivity=round(pain_sensitivity, 3),
               label_oa=label,
               affected=affected, synthetic=1, generator=SYNTH_VERSION,
               patient_id=patient.patient_id)
    return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=800)
    ap.add_argument("--seed", type=int, default=17)
    ap.add_argument("--out", default="data/synthetic/cohort.csv")
    ap.add_argument("--no-cv", action="store_true",
                    help="skip pose synthesis (questionnaire-only rows, much faster)")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    rows = []
    for i in range(args.n):
        rows.append(build_row(i, rng, full_cv=not args.no_cv))
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{args.n}  ({time.time() - t0:.1f}s)", flush=True)

    fields = list(rows[0].keys())
    with out.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    meta = {"generator": SYNTH_VERSION, "n": args.n, "seed": args.seed,
            "synthetic": True, "cv_included": not args.no_cv,
            "prevalence": round(float(np.mean([r["label_oa"] for r in rows])), 4),
            "feature_names": F.FEATURE_NAMES,
            "warning": "SYNTHETIC DATA - not evidence of accuracy in humans"}
    Path(str(out) + ".meta.json").write_text(json.dumps(meta, indent=2))
    print(f"wrote {out} ({args.n} rows, prevalence {meta['prevalence']}, "
          f"{time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
