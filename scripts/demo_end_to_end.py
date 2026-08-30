"""One command that walks the whole system, offline, with no camera or hardware.

    python scripts/demo_end_to_end.py --severity 0.75 --locale as

Camera clips are replaced by the kinematic synthesiser; everything downstream is
the real code path the app uses: pose -> gait/posture/ROM extraction -> feature
vector -> rule engine + ONNX model -> localised report. Use it as the smoke test
before every demo, and as the fallback demo if the camera or lighting fails on stage.
"""
from __future__ import annotations

import argparse
import json

import _bootstrap  # noqa: F401
from oa_core import OARiskModel, assess, new_assessment_id, render_dict, render_text
from oa_core.schema import Assessment, Patient, Questionnaire
from oa_cv import gait, posture, rom
from oa_cv.synth import synthesise, synthesise_frontal, truth_for_severity


def build(severity: float, affected: str, seed: int, locale: str) -> Assessment:
    walk, truth = synthesise(truth_for_severity(severity, affected, seed), seed=seed)
    frontal = synthesise_frontal(varus_deg=2 + 10 * severity,
                                 pelvic_obliq_deg=1.5 + 3 * severity,
                                 sway_norm=0.3 + 0.9 * severity, seed=seed)
    post, align = posture.extract(frontal)
    joint = rom.extract(rom_clips={"L": walk, "R": walk}, alignment=align)
    joint = joint.model_copy(update={"sts5_time_s": round(9.5 + 12 * severity, 1),
                                     "tug_time_s": round(8.0 + 8 * severity, 1)})
    step = lambda base: int(min(4, round(base)))  # noqa: E731
    q = Questionnaire(
        pain_walking=step(1 + 3 * severity), pain_stairs=step(1 + 3 * severity),
        pain_at_night=step(3 * severity), pain_sitting=step(2 * severity),
        pain_standing=step(1 + 2 * severity),
        stiffness_morning=step(1 + 2 * severity), stiffness_later_day=step(2 * severity),
        stiffness_duration_min=int(10 + 15 * severity),
        difficulty_stairs_down=step(1 + 3 * severity),
        difficulty_rising_from_sitting=step(3 * severity),
        difficulty_standing=step(2 * severity), difficulty_squatting=step(1 + 3 * severity),
        difficulty_walking_flat=step(2 * severity),
        prior_knee_injury=severity > 0.6, family_history_oa=severity > 0.4,
        crepitus=severity > 0.35, swelling_past_month=severity > 0.8,
        occupational_load=2 if severity > 0.3 else 1,
        daily_stair_or_slope_climbs=int(20 + 25 * severity),
        activity_min_per_week=int(200 - 120 * severity),
        pain_years=round(0.5 + 4 * severity, 1),
        worst_side=affected,
    )
    return Assessment(
        assessment_id=new_assessment_id(),
        patient=Patient(patient_id="NER-02491", age=int(38 + 25 * severity), sex="female",
                        height_cm=152.0, weight_kg=round(56 + 14 * severity, 1),
                        district_code="AS-KAM"),
        questionnaire=q, gait=gait.extract(walk), joint=joint, posture=post,
        locale=locale, device_id="demo-laptop", worker_id="chw-demo",
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--severity", type=float, default=0.75)
    ap.add_argument("--affected", default="L", choices=["L", "R"])
    ap.add_argument("--seed", type=int, default=5)
    ap.add_argument("--locale", default="en")
    ap.add_argument("--all-locales", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    a = build(args.severity, args.affected, args.seed, args.locale)
    model = OARiskModel()
    result = assess(a, model)

    print(f"[model] {'trained model loaded: ' + model.version if model.available else 'NO trained model - rule engine only'}")
    print(f"[gait ] cadence {a.gait.cadence_spm} spm | speed {a.gait.gait_speed_norm} leg-lengths/s "
          f"| step SI {a.gait.step_length_asym_pct}% | knee ROM L/R {a.gait.knee_rom_gait_l}/{a.gait.knee_rom_gait_r} deg")
    print(f"[joint] flexion L/R {a.joint.knee_flex_max_l}/{a.joint.knee_flex_max_r} deg "
          f"| ext lag {a.joint.knee_ext_deficit_l}/{a.joint.knee_ext_deficit_r} deg "
          f"| STS5 {a.joint.sts5_time_s}s | TUG {a.joint.tug_time_s}s")
    print(f"[risk ] band {result.band.value} | index {result.score_0_100} "
          f"| rules {result.rule_score_0_100} | model p={result.ml_probability}\n")

    for loc in (["en", "hi", "as"] if args.all_locales else [args.locale]):
        print(render_text(a, result, loc))
        print()
    if args.json:
        print(json.dumps(render_dict(a, result, args.locale), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
