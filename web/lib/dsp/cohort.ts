/* Client-side synthetic cohort generator.
 *
 * The static cohort.json is canonical, but this lets the dashboard resample a
 * brand-new cohort end-to-end through the real pipeline (questionnaire -> synth
 * signals -> CV extraction -> the trained model). HONESTY NOTE: every subject is
 * synthetic; scores are real model output on synthetic signals, so any metric
 * still measures how learnable THIS simulator is, not accuracy in humans.
 */
import { Rng, sampleSubject, synthWalk, synthSts, OCCUPATIONS } from "@/lib/dsp/simulator";
import { extract, toVector } from "@/lib/dsp/features";
import { predict, bandOf } from "@/lib/model/runtime";
import type { SandhiModel } from "@/lib/model/runtime";

export interface CohortOptions {
  seed: number;
  n: number;
  districts: { id: string; state: string; name: string; pop: number }[];
}

const FIRST_F = [
  "Anjali", "Priya", "Rekha", "Sunita", "Mamta", "Kavita", "Sarita", "Puja",
  "Deepa", "Minakshi", "Bina", "Rimjhim", "Nandini", "Tara", "Lakshmi",
];
const FIRST_M = [
  "Ramesh", "Suresh", "Dinesh", "Bikash", "Anil", "Kishor", "Ranjan", "Mohan",
  "Jiten", "Debu", "Hemanta", "Paban", "Nagen", "Tapan", "Upen",
];
const SURNAMES = [
  "Das", "Dey", "Sahu", "Basumatary", "Sarma", "Barman", "Hazarika", "Singha",
  "Rajbanshi", "Rongmei", "Pamei", "Laloo", "Kashyap", "Malakar", "Nath",
];

/** One new synthetic screening, scored through the real model. */
export function genSubject(
  rng: Rng,
  id: string,
  districts: CohortOptions["districts"],
  model: SandhiModel
) {
  const s = sampleSubject(rng);

  const nuisance = {
    gyro_gain: clamp(rng.normal(1, 0.055), 0.8, 1.2),
    accel_gain: clamp(rng.normal(1, 0.09), 0.7, 1.35),
    noise_gain: clamp(rng.normal(1, 0.22), 0.55, 2.1),
  };
  const walk = synthWalk(rng, s._sevFunc, nuisance);
  const sts = synthSts(rng, s._sevFunc, nuisance);

  const intake: Record<string, number> = {
    age: s.age, sex_f: s.sex_f, bmi: s.bmi, occ_squat_load: s.occ_squat_load,
    stairs_per_day: s.stairs_per_day, terrain_slope_idx: s.terrain_slope_idx,
    prior_injury: s.prior_injury, family_hx: s.family_hx,
    womac_pain: s.womac_pain, womac_stiff: s.womac_stiff,
  };
  const features = extract({ walk, sts }, intake);
  const x = toVector(features);
  const risk = predict(model, x);
  const band = bandOf(model, risk);

  const pop = districts.reduce((a, d) => a + (d.pop ?? 1), 0) || districts.length;
  const w = districts.map((d) => (d.pop ?? 1) / pop);
  const dr = districts[pick(w, rng.next())];
  const sexf = s.sex_f > 0.5;
  const first = (sexf ? FIRST_F : FIRST_M)[rng.int(0, 15)];

  return {
    id,
    name: `${first} ${SURNAMES[rng.int(0, SURNAMES.length)]}`,
    district: dr.id,
    state: dr.state,
    age: Math.round(s.age),
    sex: (sexf ? "F" : "M") as "F" | "M",
    bmi: round1(s.bmi),
    occupation: s.occupation,
    womac_pain: round1(s.womac_pain),
    risk: round4(risk),
    band,
    kl_truth: s.kl_grade,
    days_ago: rng.int(0, 84),
    synced: rng.next() > 0.06,
    followed_up: band === "refer" ? rng.next() > 0.42 : false,
    features: Object.fromEntries(Object.entries(features).map(([k, v]) => [k, round4(v)])),
  };
}

export function genCohort(opts: CohortOptions, model: SandhiModel) {
  const rng = new Rng(opts.seed >>> 0);
  const records = [];
  for (let i = 0; i < opts.n; i++) {
    records.push(genSubject(rng, `SDH-${100000 + i + 1}`, opts.districts, model));
  }
  const low = records.filter((r) => r.band === "low").length;
  const refer = records.filter((r) => r.band === "refer").length;
  return { records, bandTotals: { low, watch: records.length - low - refer, refer } };
}

/* --------------------------------------------------------------- helpers --- */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** Weighted pick from a CDF built over `weights` (same length as the array). */
function pick<T>(weights: number[], u: number): number {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (u < acc) return i;
  }
  return weights.length - 1;
}

export type { SandhiModel };
export { OCCUPATIONS };
