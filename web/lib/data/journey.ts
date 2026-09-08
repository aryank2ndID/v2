/**
 * USP 1 & 3 — a person's screening history, and what to say about it.
 *
 * A single screening is a number. Three screenings are a direction, and the
 * direction is the thing a patient can act on: "your chair-stand time is four
 * seconds faster than in March" lands where "risk 0.21" does not.
 *
 * Visits are reconstructed from the registry record so the latest visit is
 * always the one the model actually scored. Earlier visits are back-projected
 * from it — that is a demo device, and the UI says so rather than implying a
 * longitudinal cohort exists.
 */

import type { CohortRecord } from "@/lib/store";

export interface Visit {
  id: string;
  /** Days before today. */
  daysAgo: number;
  risk: number;
  band: "low" | "watch" | "refer";
  /** The two measures a patient can feel changing. */
  stsSeconds: number;
  gaitSpeed: number;
  womacPain: number;
  /** Whether the exercise plan was followed since the previous visit. */
  adherence: number;
  synced: boolean;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function bandOf(risk: number, bands: { low: number; refer: number }): Visit["band"] {
  if (risk < bands.low) return "low";
  if (risk >= bands.refer) return "refer";
  return "watch";
}

/**
 * Build the visit series for one person, oldest first.
 * Someone who kept up the exercises drifts down; someone who did not drifts up.
 */
export function visitsFor(rec: CohortRecord, bands: { low: number; refer: number }): Visit[] {
  const r = rng(hash(rec.id));
  const nPrior = 1 + Math.floor(r() * 3); // 2 to 4 visits in total
  const sts = rec.features.sts_total_s ?? 13;
  const gait = rec.features.gait_speed_est_mps ?? 1.05;

  // Direction of travel for this person, fixed once so the chart is coherent.
  const improving = r() > 0.42;
  const step = (0.012 + r() * 0.03) * (improving ? 1 : -1);

  const out: Visit[] = [];
  for (let i = nPrior; i >= 1; i--) {
    const adherence = improving
      ? Math.min(1, 0.55 + r() * 0.4)
      : Math.max(0, 0.1 + r() * 0.35);
    const risk = Math.min(0.97, Math.max(0.01, rec.risk + step * i));
    out.push({
      id: `${rec.id}-V${nPrior - i + 1}`,
      daysAgo: rec.days_ago + i * (84 + Math.floor(r() * 30)),
      risk,
      band: bandOf(risk, bands),
      stsSeconds: Math.round((sts + step * i * 34) * 10) / 10,
      gaitSpeed: Math.round((gait - step * i * 0.9) * 100) / 100,
      womacPain: Math.max(0, Math.min(20, Math.round(rec.womac_pain + step * i * 26))),
      adherence,
      synced: true,
    });
  }

  // The current visit — the one the shipped model actually produced.
  out.push({
    id: `${rec.id}-V${nPrior + 1}`,
    daysAgo: rec.days_ago,
    risk: rec.risk,
    band: rec.band,
    stsSeconds: Math.round(sts * 10) / 10,
    gaitSpeed: Math.round(gait * 100) / 100,
    womacPain: rec.womac_pain,
    adherence: improving ? 0.7 + r() * 0.3 : 0.15 + r() * 0.3,
    synced: rec.synced,
  });

  return out;
}

/* ------------------------------------------------------------- advice ---- */

/**
 * The dead-band around "no change".
 *
 * Shared by the advice line and the trend chip so the two can never disagree —
 * a chip reading "Slipping" above a sentence reading "little has changed" is
 * the kind of contradiction that makes a health worker stop trusting both.
 */
export const TREND_BETTER = -0.015;
export const TREND_WORSE = 0.02;

export type Trend = "better" | "worse" | "steady";

export function trendOf(visits: Visit[]): Trend {
  if (visits.length < 2) return "steady";
  const d = visits[visits.length - 1].risk - visits[0].risk;
  if (d < TREND_BETTER) return "better";
  if (d > TREND_WORSE) return "worse";
  return "steady";
}

export interface Advice {
  /** One sentence a patient hears. Never a probability. */
  headline: string;
  /** What changed, in the units the person felt. */
  change: string;
  /** The single next action. */
  action: string;
  tone: "good" | "steady" | "watch";
  /** What drove the reading — the model's own top contributors, in plain words. */
  drivers: { label: string; note: string }[];
}

/**
 * The AI-integrated advice line (USP 3).
 *
 * Built from the model's feature attributions and the person's own trend, not
 * from a lookup table — but deliberately expressed without the probability.
 * Handing a villager "0.21" is not information; handing them "you stand up
 * two seconds faster than in spring" is.
 */
export function adviseFrom(visits: Visit[], top: { feature: string; label: string }[] = []): Advice {
  const now = visits[visits.length - 1];
  const then = visits.length > 1 ? visits[0] : null;

  const dRisk = then ? now.risk - then.risk : 0;
  const dSts = then ? now.stsSeconds - then.stsSeconds : 0;
  const dPain = then ? now.womacPain - then.womacPain : 0;
  const months = then ? Math.max(1, Math.round((then.daysAgo - now.daysAgo) / 30)) : 0;

  const drivers = top.slice(0, 3).map((t) => ({
    label: t.label,
    note: DRIVER_NOTE[t.feature] ?? "Contributed to this reading.",
  }));

  if (!then) {
    return {
      headline: "This is the first screening on record.",
      change: "Come back in three months so we can see the direction.",
      action: now.band === "refer"
        ? "Take the referral slip to the health centre."
        : "Start the exercise plan below.",
      tone: now.band === "refer" ? "watch" : "steady",
      drivers,
    };
  }

  if (dRisk < TREND_BETTER) {
    return {
      headline: "The knee is holding up better than last time.",
      change: dSts < -0.4
        ? `You stand up ${Math.abs(dSts).toFixed(1)} seconds faster than ${months} months ago.`
        : dPain < 0
          ? `Pain score down ${Math.abs(dPain)} points over ${months} months.`
          : `Steady improvement over ${months} months.`,
      action: "Keep the same exercises. Nothing new is needed.",
      tone: "good",
      drivers,
    };
  }

  if (dRisk > TREND_WORSE) {
    return {
      headline: "The knee is working harder than it was.",
      change: dSts > 0.4
        ? `Standing up takes ${dSts.toFixed(1)} seconds longer than ${months} months ago.`
        : `Pain and stiffness have crept up over ${months} months.`,
      action: now.band === "refer"
        ? "See a clinician. Take the slip and this history."
        : "Add the chair stand daily and re-screen in six weeks.",
      tone: "watch",
      drivers,
    };
  }

  return {
    headline: "Little has changed since the last visit.",
    change: `Roughly the same over ${months} months — no decline.`,
    action: "Carry on with the plan. Re-screen in three months.",
    tone: "steady",
    drivers,
  };
}

/** Plain-language reasons behind the model's top contributors. */
const DRIVER_NOTE: Record<string, string> = {
  age: "Age is the strongest single factor, and it is not something to fix.",
  bmi: "Weight goes through the knee with every step.",
  womac_pain: "What you reported about your own pain.",
  womac_stiff: "Morning stiffness that takes a while to loosen.",
  sts_total_s: "How long five chair stands took.",
  sts_mean_rep_s: "Time per single stand.",
  sts_smoothness_ldlj: "How smoothly you rise — hesitation shows here.",
  sts_trunk_lean_dps: "How much you lean forward to help the knees.",
  gait_speed_est_mps: "Walking speed over the 30-second walk.",
  cadence_spm: "Steps per minute — pain slows this down.",
  step_asym_pct: "One leg is carrying less than the other.",
  double_support_pct: "Time spent with both feet down for safety.",
  stride_time_cv_pct: "How even your stride is from step to step.",
  knee_flex_rom_deg: "How far the knee bends while walking.",
  swing_peak_flex_deg: "Knee bend as the leg swings through.",
  occ_squat_load: "Squatting and crouching at work.",
  terrain_slope_idx: "The slope you walk every day.",
  stairs_per_day: "Daily stairs and climbs.",
  prior_injury: "An old knee injury raises later risk.",
  family_hx: "Knee trouble runs in the family.",
  sex_f: "Women report knee OA at markedly higher rates.",
  heelstrike_impact_g: "The impact spike when the heel lands.",
  shank_swing_peak_dps: "How fast the shin swings through.",
  stance_pct: "Share of each step spent on the ground.",
  stride_time_s: "How long one full stride takes.",
  sts_peak_angvel_dps: "Peak speed coming out of the chair.",
  sts_rep_cv_pct: "Whether the five stands stayed even.",
};

export const driverNote = (f: string) => DRIVER_NOTE[f] ?? "Contributed to this reading.";
