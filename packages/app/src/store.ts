/**
 * SANDHI - app state model and the scoring pipeline.
 *
 * The classification contract mirrors the web dashboard: features are produced
 * by this exact extractor (features.ts -> toVector), fed to the exported
 * booster (assets/model.json), and only the risk band + guidance selectors live
 * in the UI layer. guidanceKeysFor/recommendationKeysFor are ports of
 * oa_core/guidance.py, mapped onto the app's intake surface.
 */
import modelJson from "../assets/model.json";
import { Features, Session, extract, toVector } from "./lib/features";
import {
  SandhiModel,
  bandOf,
  explain,
  Explanation,
  predict,
} from "./lib/runtime";
import { OCCUPATIONS } from "./lib/simulator";
import { Band } from "./lib/runtime";

export const model = modelJson as unknown as SandhiModel;

export type Sex = "M" | "F";

export interface Intake {
  patient: string;
  district: string;
  age: number;
  sex: Sex;
  bmi: number;
  occupation: string;
  occ_squat_load: number;
  stairs_per_day: number;
  terrain_slope_idx: number;
  prior_injury: number;
  family_hx: number;
  womac_pain: number;
  womac_stiff: number;
}

export function occupationFor(name: string) {
  return (
    OCCUPATIONS.find((o) => o.name === name) ?? { name, squat: 0, stairs: 40, terrain: 0.3 }
  );
}

export function defaultIntake(): Intake {
  const occ = occupationFor("Homemaker");
  return {
    patient: "",
    district: "",
    age: 42,
    sex: "M",
    bmi: 24,
    occupation: "Homemaker",
    occ_squat_load: occ.squat,
    stairs_per_day: occ.stairs,
    terrain_slope_idx: occ.terrain,
    prior_injury: 0,
    family_hx: 0,
    womac_pain: 0,
    womac_stiff: 0,
  };
}

export function toIntakeNumbers(intake: Intake): Record<string, number> {
  return {
    age: intake.age,
    sex_f: intake.sex === "F" ? 1 : 0,
    bmi: intake.bmi,
    occ_squat_load: intake.occ_squat_load,
    stairs_per_day: intake.stairs_per_day,
    terrain_slope_idx: intake.terrain_slope_idx,
    prior_injury: intake.prior_injury,
    family_hx: intake.family_hx,
    womac_pain: intake.womac_pain,
    womac_stiff: intake.womac_stiff,
  };
}

export function makeClientId(): string {
  const rnd = Math.floor(Math.random() * 0xffffff).toString(36);
  return `SAN-${Date.now().toString(36)}-${rnd}`.toUpperCase();
}

export interface ScoreOutcome {
  client_id: string;
  risk: number;
  band: Band;
  features: Features;
  explanation: Explanation[];
  guidanceKeys: string[];
  recommendationKeys: string[];
}

export function scoreSession(intake: Intake, session: Session): ScoreOutcome {
  const f = extract(session, toIntakeNumbers(intake));
  const x = toVector(f);
  const risk = predict(model, x);
  const band = bandOf(model, risk);
  return {
    client_id: makeClientId(),
    risk,
    band,
    features: f,
    explanation: explain(model, x, 6),
    guidanceKeys: guidanceKeysFor(intake, band),
    recommendationKeys: recommendationKeysFor(band),
  };
}

export function guidanceKeysFor(intake: Intake, band: Band): string[] {
  const keys: string[] = [];
  if (intake.bmi >= 25) keys.push("guidance.weight");
  keys.push("guidance.activity");
  if (intake.occ_squat_load >= 2) keys.push("guidance.avoid_squat");
  if (intake.stairs_per_day >= 20 || intake.occ_squat_load >= 2)
    keys.push("guidance.slope_load");
  if (band !== "low") keys.push("guidance.footwear");
  if (intake.womac_stiff >= 2) keys.push("guidance.warmth");
  keys.push("guidance.nutrition");
  return [...new Set(keys)];
}

export function recommendationKeysFor(band: Band): string[] {
  if (band === "refer") return ["rec.refer_specialist", "rec.clinical_eval"];
  if (band === "watch") return ["rec.refer_phc"];
  return ["rec.recheck_6m"];
}

export function bandRiskLabel(band: Band): "HIGH" | "MODERATE" | "LOW" {
  return band === "refer" ? "HIGH" : band === "watch" ? "MODERATE" : "LOW";
}