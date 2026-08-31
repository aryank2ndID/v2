/**
 * SANDHI — feature extraction, TypeScript port.
 *
 * This is a line-for-line translation of ml/features.py. It runs on the phone,
 * on the raw BLE stream, with no network. If this file and the Python one ever
 * disagree, the model is being fed different numbers than it was trained on —
 * which is why tools/parity_check.mjs replays the same fixtures through both
 * and fails the build on any drift above 1e-6.
 */

export const FEATURE_NAMES = [
  // gait — 30 s level walk
  "cadence_spm", "stride_time_s", "stride_time_cv_pct", "stance_pct",
  "double_support_pct", "knee_flex_rom_deg", "swing_peak_flex_deg",
  "shank_swing_peak_dps", "heelstrike_impact_g", "step_asym_pct",
  "gait_speed_est_mps",
  // sit-to-stand — 5 reps
  "sts_total_s", "sts_mean_rep_s", "sts_peak_angvel_dps",
  "sts_smoothness_ldlj", "sts_rep_cv_pct", "sts_trunk_lean_dps",
  // vibroarthrography — piezo over the joint line
  "vag_hf_ratio", "vag_burst_rate_hz", "vag_spec_entropy", "vag_rms_x1000",
  // intake — asked by the ASHA worker
  "age", "sex_f", "bmi", "occ_squat_load", "stairs_per_day",
  "terrain_slope_idx", "prior_injury", "family_hx", "womac_pain", "womac_stiff",
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type Features = Record<string, number>;

export const INTAKE_FEATURES: string[] = [
  "age", "sex_f", "bmi", "occ_squat_load", "stairs_per_day",
  "terrain_slope_idx", "prior_injury", "family_hx", "womac_pain", "womac_stiff",
];

/** Channel grouping, used by the UI to show which sensor drove a decision. */
export const FEATURE_CHANNEL: Record<string, "gait" | "sts" | "acoustic" | "intake"> =
  Object.fromEntries(FEATURE_NAMES.map((n, i) => [
    n, i < 11 ? "gait" : i < 17 ? "sts" : i < 21 ? "acoustic" : "intake",
  ])) as Record<string, "gait" | "sts" | "acoustic" | "intake">;

/* ------------------------------------------------------------- helpers --- */

function mean(v: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i];
  return v.length ? s / v.length : 0;
}

function std(v: ArrayLike<number>): number {
  const m = mean(v);
  let s = 0;
  for (let i = 0; i < v.length; i++) s += (v[i] - m) ** 2;
  return v.length ? Math.sqrt(s / v.length) : 0;
}

/** numpy's default (linear) percentile, so the port matches exactly. */
export function percentile(v: ArrayLike<number>, q: number): number {
  const a = Array.from(v).sort((x, y) => x - y);
  if (!a.length) return 0;
  const pos = (q / 100) * (a.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

function median(v: ArrayLike<number>): number { return percentile(v, 50); }

function cvPct(v: ArrayLike<number>): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  return m === 0 ? 0 : (100 * std(v)) / m;
}

function findPeaks(x: ArrayLike<number>, minDist: number, height: number): number[] {
  const idx: number[] = [];
  let last = -1e9;
  for (let i = 1; i < x.length - 1; i++) {
    if (x[i] > height && x[i] >= x[i - 1] && x[i] > x[i + 1]) {
      if (i - last >= minDist) { idx.push(i); last = i; }
      else if (idx.length && x[i] > x[idx[idx.length - 1]]) { idx[idx.length - 1] = i; last = i; }
    }
  }
  return idx;
}

/** Parabolic sub-sample peak refinement — see the note in features.py. */
function refine(x: ArrayLike<number>, idx: number[]): number[] {
  return idx.map((i) => {
    if (i <= 0 || i >= x.length - 1) return i;
    const a = x[i - 1], b = x[i], c = x[i + 1];
    const den = a - 2 * b + c;
    return Math.abs(den) > 1e-12 ? i + 0.5 * (a - c) / den : i;
  });
}

function movingAvg(x: ArrayLike<number>, w: number): Float64Array {
  // Mirrors np.convolve(x, ones(w)/w, mode="same") including its edge behaviour.
  const n = x.length, out = new Float64Array(n);
  const half = Math.floor(w / 2);
  let run = 0;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { run += x[i]; pre[i + 1] = run; }
  for (let i = 0; i < n; i++) {
    // np.convolve(mode="same") centres an even window one sample to the left.
    const lo = Math.max(0, i - half);
    const hi = Math.min(n, w % 2 === 0 ? i + half : i + half + 1);
    out[i] = (pre[hi] - pre[lo]) / w;
  }
  return out;
}

function maxOf(x: ArrayLike<number>): number {
  let m = -Infinity;
  for (let i = 0; i < x.length; i++) if (x[i] > m) m = x[i];
  return m;
}

function maxAbs(x: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
  return m;
}

function diff(x: ArrayLike<number>): Float64Array {
  const o = new Float64Array(Math.max(0, x.length - 1));
  for (let i = 1; i < x.length; i++) o[i - 1] = x[i] - x[i - 1];
  return o;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

/* ---------------------------------------------------------------- gait --- */

export interface WalkSignal {
  fs: number;
  knee_angle: ArrayLike<number>;
  shank_gyro: ArrayLike<number>;
  thigh_gyro: ArrayLike<number>;
  shank_acc: ArrayLike<number>;
}

export function gaitFeatures(walk: WalkSignal): Features {
  const fs = walk.fs;
  const knee = walk.knee_angle, sg = walk.shank_gyro, acc = walk.shank_acc;

  const thr = 0.42 * percentile(sg, 99);
  const pk = findPeaks(sg, Math.trunc(0.45 * fs), Math.max(thr, 40));

  let strideS: number[];
  if (pk.length >= 3) {
    strideS = Array.from(diff(refine(sg, pk)))
      .map((d) => d / fs)
      .filter((s) => s > 0.55 && s < 2.6);
  } else strideS = [1.1];
  if (!strideS.length) strideS = [1.1];

  const strideTime = median(strideS);
  const cadence = 120 / strideTime;

  // Within-limb CV: pooling both limbs folds asymmetry into variability.
  let strideCv: number;
  if (strideS.length >= 6) {
    const a = strideS.filter((_, i) => i % 2 === 0);
    const b = strideS.filter((_, i) => i % 2 === 1);
    strideCv = 0.5 * (cvPct(a) + cvPct(b));
  } else strideCv = cvPct(strideS);

  let stepAsym = 0;
  if (strideS.length >= 4) {
    const a = strideS.filter((_, i) => i % 2 === 0);
    const b = strideS.filter((_, i) => i % 2 === 1);
    const m = Math.min(a.length, b.length);
    const ma = mean(a.slice(0, m)), mb = mean(b.slice(0, m));
    const den = 0.5 * (ma + mb);
    stepAsym = den ? (100 * Math.abs(ma - mb)) / den : 0;
  }

  const smooth = movingAvg(acc, 9);
  const accHp = new Float64Array(acc.length);
  for (let i = 0; i < acc.length; i++) accHp[i] = acc[i] - smooth[i];
  const hs = findPeaks(accHp, Math.trunc(0.42 * fs), 0.35 * percentile(accHp, 99));
  const impact = hs.length ? median(hs.map((i) => accHp[i])) : 0;

  const p98 = percentile(sg, 98);
  let above = 0;
  for (let i = 0; i < sg.length; i++) if (sg[i] > 0.12 * p98) above++;
  const swingPct = (100 * above) / sg.length;
  const stancePct = clamp(100 - swingPct, 52, 78);
  const doubleSupport = clamp(2 * (stancePct - 50), 8, 40);

  const kpk = findPeaks(knee, Math.trunc(0.45 * fs), percentile(knee, 75));
  const swingPeak = kpk.length ? median(kpk.map((i) => knee[i])) : maxOf(knee);
  const rom = percentile(knee, 98) - percentile(knee, 2);

  const shankPeak = pk.length ? median(pk.map((i) => sg[i])) : maxOf(sg);
  const stepLen = 0.00118 * shankPeak + 0.0022 * swingPeak;
  const speed = clamp(stepLen * (cadence / 60), 0.15, 2.2);

  return {
    cadence_spm: cadence,
    stride_time_s: strideTime,
    stride_time_cv_pct: strideCv,
    stance_pct: stancePct,
    double_support_pct: doubleSupport,
    knee_flex_rom_deg: rom,
    swing_peak_flex_deg: swingPeak,
    shank_swing_peak_dps: shankPeak,
    heelstrike_impact_g: impact,
    step_asym_pct: stepAsym,
    gait_speed_est_mps: speed,
  };
}

/* -------------------------------------------------------- sit-to-stand --- */

export interface StsSignal { fs: number; thigh_gyro: ArrayLike<number>; trunk_gyro: ArrayLike<number>; }

export function stsFeatures(sts: StsSignal): Features {
  const fs = sts.fs, th = sts.thigh_gyro, tr = sts.trunk_gyro;
  const pk = findPeaks(th, Math.trunc(0.7 * fs), 0.4 * percentile(th, 99));

  let reps: number[], total: number;
  if (pk.length >= 2) {
    reps = Array.from(diff(pk)).map((d) => d / fs);
    total = ((pk[pk.length - 1] - pk[0]) / fs) * (pk.length / Math.max(1, pk.length - 1));
  } else { reps = [2.0]; total = 10.0; }

  const meanRep = mean(reps);
  const repCv = cvPct(reps);
  const peakAv = pk.length ? median(pk.map((i) => th[i])) : maxOf(th);

  let seg: number[] = pk.length >= 2
    ? Array.from({ length: pk[pk.length - 1] - pk[0] }, (_, k) => th[pk[0] + k])
    : Array.from(th);
  if (seg.length < 8) seg = Array.from(th);

  const jerk = Array.from(diff(seg)).map((d) => d * fs);
  const dur = seg.length / fs;
  const peakV = Math.max(1e-6, maxAbs(seg));
  const dlj = ((dur ** 3 / peakV ** 2) * jerk.reduce((s, j) => s + j * j, 0)) / fs;
  const ldlj = -Math.log(Math.max(dlj, 1e-12));

  return {
    sts_total_s: clamp(total, 3, 60),
    sts_mean_rep_s: meanRep,
    sts_peak_angvel_dps: peakAv,
    sts_smoothness_ldlj: ldlj,
    sts_rep_cv_pct: repCv,
    sts_trunk_lean_dps: percentile(tr, 98),
  };
}

/* ----------------------------------------------------------------- VAG --- */

/** Band energy by direct correlation — no FFT dependency, matches Python. */
export function bandEnergy(x: ArrayLike<number>, fs: number, lo: number, hi: number, nbands = 24) {
  const n = x.length;
  const edges = Array.from({ length: nbands + 1 }, (_, i) => lo + ((hi - lo) * i) / nbands);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = n > 8 ? 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) : 1;
  const bands = new Float64Array(nbands);
  const centers = new Float64Array(nbands);
  for (let b = 0; b < nbands; b++) {
    const f = 0.5 * (edges[b] + edges[b + 1]);
    centers[b] = f;
    const k = (2 * Math.PI * f) / fs;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const v = x[i] * w[i];
      re += v * Math.cos(k * i);
      im += v * Math.sin(k * i);
    }
    bands[b] = (re * re + im * im) / (n * n);
  }
  return { bands, centers };
}

export interface VagResult {
  vag_hf_ratio: number;
  vag_burst_rate_hz: number;
  vag_spec_entropy: number;
  vag_rms_x1000: number;
  /** 24-band spectrum, kept for the UI's spectrogram strip. Not a model input. */
  _bands: number[];
  _centers: number[];
}

export function vagFeatures(vag: { fs: number; mic: ArrayLike<number> }): VagResult {
  const fs = vag.fs, x = vag.mic;
  const dn = Math.ceil(x.length / 2);
  const xd = new Float64Array(dn);
  for (let i = 0; i < dn; i++) xd[i] = x[i * 2];

  const { bands, centers } = bandEnergy(xd, fs / 2, 20, 950, 24);
  let total = 1e-15;
  for (let i = 0; i < bands.length; i++) total += bands[i];
  let hf = 0;
  for (let i = 0; i < bands.length; i++) if (centers[i] > 200) hf += bands[i];
  hf /= total;

  let ent = 0;
  for (let i = 0; i < bands.length; i++) {
    const p = bands[i] / total;
    ent -= p * Math.log(p + 1e-15);
  }
  ent /= Math.log(bands.length);

  // Bursts are detected on the HIGH-PASSED signal (see features.py).
  const sm = movingAvg(x, 32);
  const xh = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) xh[i] = x[i] - sm[i];

  const win = Math.max(4, Math.trunc(0.01 * fs));
  const nfr = Math.floor(xh.length / win);
  const e = new Float64Array(nfr);
  for (let i = 0; i < nfr; i++) {
    let s = 0;
    for (let j = i * win; j < (i + 1) * win; j++) s += xh[j] * xh[j];
    e[i] = s;
  }
  const floor = median(e) + 1e-12;
  let bursts = 0, armed = true;
  for (let i = 0; i < nfr; i++) {
    if (e[i] > 6 * floor && armed) { bursts++; armed = false; }
    else if (e[i] < 2.5 * floor) armed = true;
  }
  const seconds = x.length / fs;

  let ms = 0;
  for (let i = 0; i < x.length; i++) ms += x[i] * x[i];

  return {
    vag_hf_ratio: hf,
    vag_burst_rate_hz: bursts / seconds,
    vag_spec_entropy: ent,
    vag_rms_x1000: Math.sqrt(ms / x.length) * 1000,
    _bands: Array.from(bands),
    _centers: Array.from(centers),
  };
}

/* ---------------------------------------------------------------- join --- */

export interface Session { walk: WalkSignal; sts: StsSignal; vag: { fs: number; mic: ArrayLike<number> }; }

export function extract(session: Session, intake: Record<string, number>): Features {
  const v = vagFeatures(session.vag);
  const { _bands, _centers, ...vagOnly } = v;
  const f: Features = { ...gaitFeatures(session.walk), ...stsFeatures(session.sts), ...vagOnly };
  for (const k of INTAKE_FEATURES) f[k] = Number(intake[k]);
  return f;
}

export function toVector(f: Features): number[] {
  return FEATURE_NAMES.map((n) => Number(f[n]));
}
