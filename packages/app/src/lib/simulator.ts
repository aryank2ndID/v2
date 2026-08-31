/**
 * SANDHI - signal simulator, TypeScript port of web/lib/dsp/simulator.ts.
 *
 * ===================== READ THIS =====================
 * This file FABRICATES sensor data. It stands in for the ESP32 kit while the
 * hardware is being built. Every waveform the demo draws comes from here, not
 * from a knee. The UI must always say so.
 * =====================================================
 */

export const FS_IMU = 100;
export const FS_MIC = 4000;
export const WALK_SECONDS = 30;
export const STS_REPS = 5;
export const VAG_SECONDS = 6;

export class Rng {
  private s: number;
  private spare: number | null = null;
  constructor(seed = 1) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  normal(mu = 0, sd = 1): number {
    if (this.spare !== null) { const v = this.spare; this.spare = null; return mu + sd * v; }
    let u = 0, v = 0, s = 0;
    do { u = this.next() * 2 - 1; v = this.next() * 2 - 1; s = u * u + v * v; }
    while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * f;
    return mu + sd * u * f;
  }
  uniform(a: number, b: number) { return a + (b - a) * this.next(); }
  int(a: number, b: number) { return a + Math.floor(this.next() * (b - a)); }
  poisson(lam: number): number {
    if (lam > 30) return Math.max(0, Math.round(this.normal(lam, Math.sqrt(lam))));
    const L = Math.exp(-lam); let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface Occupation { name: string; squat: number; stairs: number; terrain: number; }

export const OCCUPATIONS: Occupation[] = [
  { name: "Terrace farming", squat: 3, stairs: 180, terrain: 0.86 },
  { name: "Tea garden work", squat: 3, stairs: 120, terrain: 0.61 },
  { name: "Livestock / grazing", squat: 2, stairs: 200, terrain: 0.90 },
  { name: "Head-load portering", squat: 3, stairs: 240, terrain: 0.93 },
  { name: "Weaving (floor loom)", squat: 3, stairs: 30, terrain: 0.20 },
  { name: "Homemaker", squat: 2, stairs: 60, terrain: 0.35 },
  { name: "Shopkeeper", squat: 1, stairs: 40, terrain: 0.28 },
  { name: "School teacher", squat: 0, stairs: 70, terrain: 0.32 },
  { name: "Driver", squat: 1, stairs: 25, terrain: 0.30 },
  { name: "Construction labour", squat: 2, stairs: 150, terrain: 0.55 },
  { name: "Office / clerical", squat: 0, stairs: 35, terrain: 0.25 },
  { name: "Student", squat: 0, stairs: 110, terrain: 0.40 },
];

export interface Subject {
  age: number; sex_f: number; bmi: number;
  occupation: string; occ_squat_load: number; stairs_per_day: number;
  terrain_slope_idx: number; prior_injury: number; family_hx: number;
  womac_pain: number; womac_stiff: number;
  _sev: number; _sevFunc: number; _sevVag: number; _coupling: number;
  kl_grade: number; label: number;
}

export function sampleSubject(rng: Rng): Subject {
  const age = clamp(rng.normal(46, 15), 18, 88);
  const sex_f = rng.next() < 0.54 ? 1 : 0;
  const bmi = clamp(rng.normal(24.4 + 0.02 * (age - 40), 3.6), 15.5, 41);
  const occ = OCCUPATIONS[rng.int(0, OCCUPATIONS.length)];
  const stairs = Math.max(0, rng.normal(occ.stairs, occ.stairs * 0.25));
  const terrain = clamp(rng.normal(occ.terrain, 0.08), 0, 1);
  const prior_injury = rng.next() < 0.11 ? 1 : 0;
  const family_hx = rng.next() < 0.18 ? 1 : 0;

  let lin =
    -3.9 +
    0.062 * (age - 40) +
    0.088 * (bmi - 23) +
    0.42 * sex_f +
    0.3 * occ.squat +
    0.0022 * stairs +
    0.95 * terrain +
    0.85 * prior_injury +
    0.55 * family_hx +
    0.019 * (age - 40) * Math.max(0, bmi - 25) * 0.1;
  lin += rng.normal(0, 1.95);
  const sev = 1 / (1 + Math.exp(-lin));

  const cuts = [0.18, 0.4, 0.62, 0.83];
  let kl = 0;
  while (kl < 4 && sev >= cuts[kl]) kl++;
  if (rng.next() < 0.1) kl = clamp(kl + (rng.next() < 0.5 ? 1 : -1), 0, 4);

  const ageDecl = clamp((age - 55) / 35, 0, 1);
  const bmiMech = clamp((bmi - 27) / 12, 0, 1);
  const otherCause = (rng.next() < 0.12 ? 1 : 0) * rng.next();
  const sevFunc = clamp(
    0.66 * sev + 0.18 * ageDecl + 0.12 * bmiMech + 0.3 * otherCause + rng.normal(0, 0.17), 0, 1);
  const sevVag = clamp(0.78 * sev + 0.1 * ageDecl + rng.normal(0, 0.15), 0, 1);
  const coupling = clamp(rng.normal(1, 0.3), 0.3, 1.9);

  const sym = 0.45 * sev + 0.4 * sevFunc + 0.15 * otherCause;
  const womac_pain = clamp(rng.normal(2.2 + 13.5 * sym, 3.6), 0, 20);
  const womac_stiff = clamp(rng.normal(0.7 + 5.4 * sym, 1.7), 0, 8);

  return {
    age, sex_f, bmi,
    occupation: occ.name, occ_squat_load: occ.squat,
    stairs_per_day: stairs, terrain_slope_idx: terrain,
    prior_injury, family_hx, womac_pain, womac_stiff,
    _sev: sev, _sevFunc: sevFunc, _sevVag: sevVag,
    _coupling: coupling,
    kl_grade: kl, label: kl >= 2 ? 1 : 0,
  };
}

export interface WalkSignal {
  fs: number;
  knee_angle: Float64Array;
  shank_gyro: Float64Array;
  thigh_gyro: Float64Array;
  shank_acc: Float64Array;
}

export function synthWalk(rng: Rng, sev: number, nz: Partial<{ gyro_gain: number; accel_gain: number; noise_gain: number }> = {}): WalkSignal {
  const gyroGain = nz.gyro_gain ?? 1, accelGain = nz.accel_gain ?? 1, noiseGain = nz.noise_gain ?? 1;
  const n = WALK_SECONDS * FS_IMU;

  const strideT = 1.06 + 0.3 * sev + rng.normal(0, 0.035);
  const cv = 0.021 + 0.055 * sev;
  const rom = 62 - 19 * sev + rng.normal(0, 2.6);
  const stanceFrac = 0.605 + 0.055 * sev;
  const asym = 0.012 + 0.085 * sev * rng.next();

  const phases: [number, number][] = [];
  let cursor = 0, k = 0;
  while (cursor < WALK_SECONDS + 2 * strideT) {
    const jitter = rng.normal(0, cv * strideT);
    const side = 1 + (k % 2 ? asym : -asym);
    const dur = Math.max(0.55, strideT * side + jitter);
    phases.push([cursor, dur]);
    cursor += dur; k++;
  }

  const knee = new Float64Array(n);
  const shankGyro = new Float64Array(n);
  const thighGyro = new Float64Array(n);
  const shankAcc = new Float64Array(n);
  const swSigma = 0.092 - 0.019 * sev;

  for (const [t0, dur] of phases) {
    const i0 = Math.trunc(t0 * FS_IMU);
    const i1 = Math.min(n, Math.trunc((t0 + dur) * FS_IMU));
    if (i0 >= n || i1 <= i0) continue;
    const len = i1 - i0;
    const swingC = stanceFrac + (1 - stanceFrac) * 0.42;
    const pk = 430 - 150 * sev;

    for (let j = 0; j < len; j++) {
      const p = j / len;
      const stanceBump = 16 * Math.exp(-((p - 0.13) ** 2) / (2 * 0.055 ** 2));
      const swing = rom * Math.exp(-((p - swingC) ** 2) / (2 * 0.075 ** 2));
      knee[i0 + j] += 4 + stanceBump * (1 - 0.35 * sev) + swing;
      shankGyro[i0 + j] += pk * Math.exp(-((p - swingC) ** 2) / (2 * swSigma ** 2));
      shankGyro[i0 + j] -= (150 - 45 * sev) * Math.exp(-((p - 0.06) ** 2) / (2 * 0.045 ** 2));
      thighGyro[i0 + j] += (210 - 62 * sev) * Math.exp(-((p - swingC + 0.06) ** 2) / (2 * 0.085 ** 2));
    }

    const impact = 2.35 - 0.72 * sev;
    for (const [idx, amp] of [[i0, impact], [i0 + Math.trunc(len * stanceFrac), impact * 0.45]] as [number, number][]) {
      if (idx >= 0 && idx < n - 12) {
        for (let d = 0; d < 12; d++) shankAcc[idx + d] += amp * Math.exp(-d / 2.4) * Math.cos(d * 1.15);
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const t = i / FS_IMU;
    shankGyro[i] = shankGyro[i] * gyroGain + rng.normal(0, 7.5 * noiseGain);
    thighGyro[i] = thighGyro[i] * gyroGain + rng.normal(0, 6 * noiseGain);
    shankAcc[i] = shankAcc[i] * accelGain + 1 + 0.22 * Math.sin((2 * Math.PI * t) / strideT)
      + rng.normal(0, 0.045 * noiseGain);
    knee[i] += rng.normal(0, 0.9 * noiseGain);
  }

  return { knee_angle: knee, shank_gyro: shankGyro, thigh_gyro: thighGyro, shank_acc: shankAcc, fs: FS_IMU };
}

export interface StsSignal { fs: number; thigh_gyro: Float64Array; trunk_gyro: Float64Array; }

export function synthSts(rng: Rng, sev: number, nz: Partial<{ gyro_gain: number }> = {}): StsSignal {
  const gyroGain = nz.gyro_gain ?? 1;
  const repT = 1.72 + 1.55 * sev + rng.normal(0, 0.18);
  const rest = 0.42 + 0.3 * sev;
  const total = STS_REPS * (repT + rest) + 1.2;
  const n = Math.trunc(total * FS_IMU);
  const thigh = new Float64Array(n);
  const trunk = new Float64Array(n);
  let cursor = 0.6;

  for (let r = 0; r < STS_REPS; r++) {
    const dur = Math.max(0.8, repT * (1 + rng.normal(0, 0.06 + 0.09 * sev)));
    const i0 = Math.trunc(cursor * FS_IMU);
    const i1 = Math.min(n, Math.trunc((cursor + dur) * FS_IMU));
    if (i1 <= i0) break;
    const len = i1 - i0;
    const peak = 205 - 96 * sev;
    for (let j = 0; j < len; j++) {
      const p = j / len;
      const rise = peak * Math.exp(-((p - 0.32) ** 2) / (2 * 0.13 ** 2));
      const fall = -peak * 0.82 * Math.exp(-((p - 0.74) ** 2) / (2 * 0.15 ** 2));
      const notch = 1 - 0.3 * sev * Math.exp(-((p - 0.47) ** 2) / (2 * 0.05 ** 2));
      thigh[i0 + j] += (rise + fall) * notch;
      trunk[i0 + j] += (128 + 52 * sev) * Math.exp(-((p - 0.22) ** 2) / (2 * 0.11 ** 2));
    }
    cursor += dur + Math.max(0.15, rest * (1 + rng.normal(0, 0.2)));
  }
  for (let i = 0; i < n; i++) {
    thigh[i] = thigh[i] * gyroGain + rng.normal(0, 5.5);
    trunk[i] = trunk[i] * gyroGain + rng.normal(0, 4.5);
  }
  return { thigh_gyro: thigh, trunk_gyro: trunk, fs: FS_IMU };
}

export function synthVag(rng: Rng, sev: number, coupling = 1): { mic: Float64Array; fs: number } {
  const n = VAG_SECONDS * FS_MIC;
  const white = new Float64Array(n);
  for (let i = 0; i < n; i++) white[i] = rng.normal(0, 1);

  const conv = (w: number) => {
    const out = new Float64Array(n);
    const half = Math.floor(w / 2);
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + white[i];
    for (let i = 0; i < n; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(n, w % 2 === 0 ? i + half : i + half + 1);
      out[i] = (pre[hi] - pre[lo]) / w;
    }
    return out;
  };
  const lp = conv(64), mid = conv(12);

  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / FS_MIC;
    x[i] = 0.085 * lp[i] + 0.012 * mid[i] + 0.0016 * white[i]
      + 0.055 * Math.sin(2 * Math.PI * 0.55 * t)
      + 0.03 * Math.sin(2 * Math.PI * 1.4 * t + 1.1);
  }

  const nBursts = rng.poisson(1 + 26 * Math.pow(sev, 1.55));
  for (let b = 0; b < nBursts; b++) {
    const c = rng.int(0, n - 400);
    const dur = rng.int(28, 190);
    const f = rng.uniform(230, 1350) * (1 + 0.35 * sev);
    const amp = (0.03 + 0.115 * sev) * rng.uniform(0.5, 1.6) * coupling;
    for (let d = 0; d < dur; d++) {
      x[c + d] += amp * Math.exp(-d / (dur / 3.1)) * Math.sin((2 * Math.PI * f * d) / FS_MIC);
    }
  }
  return { mic: x, fs: FS_MIC };
}

export function synthSession(rng: Rng, subj: Subject) {
  const nuisance = {
    gyro_gain: clamp(rng.normal(1, 0.055), 0.8, 1.2),
    accel_gain: clamp(rng.normal(1, 0.09), 0.7, 1.35),
    noise_gain: clamp(rng.normal(1, 0.22), 0.55, 2.1),
  };
  return {
    walk: synthWalk(rng, subj._sevFunc, nuisance),
    sts: synthSts(rng, subj._sevFunc, nuisance),
    vag: synthVag(rng, subj._sevVag, subj._coupling),
  };
}