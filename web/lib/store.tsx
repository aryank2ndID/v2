"use client";
/**
 * SANDHI — app state.
 *
 * Holds the three things every screen needs: the model bundle, the scored
 * registry, and the outbox. The outbox is the whole offline story: a screening
 * is written to local storage the moment it is scored, and only leaves the
 * phone when a sync is attempted and the link is up.
 */
import * as React from "react";
import type { SandhiModel } from "./model/runtime";

export interface CohortRecord {
  id: string; name: string; district: string; state: string;
  age: number; sex: "F" | "M"; bmi: number; occupation: string;
  womac_pain: number; risk: number; band: "low" | "watch" | "refer";
  kl_truth: number; days_ago: number; synced: boolean; followed_up: boolean;
  features: Record<string, number>;
}

export interface District {
  id: string; name: string; state: string;
  lat: number; lon: number; terrain: number; phc: number; pop: number;
}

export interface Cohort { bands: { low: number; refer: number }; districts: District[]; records: CohortRecord[]; }

export interface Metrics {
  disclaimer: string; generated: string;
  cohort: { total: number; train: number; val: number; test: number; prevalence: number; kl_distribution: Record<string, number> };
  model: { kind: string; trees: number; depth: number; lr: number; n_features: number };
  test: { auc: number; brier: number };
  bands: { low: number; refer: number };
  operating_points: { refer: OpPoint; low: OpPoint };
  threshold_sweep: OpPoint[];
  roc: [number, number][];
  calibration: { bin: [number, number]; n: number; predicted: number; observed: number }[];
  importances: { feature: string; gain: number }[];
  ablation: Record<string, { auc: number; n_features: number; sensitivity: number; specificity: number }>;
  feature_stats: { feature: string; neg_mean: number; pos_mean: number; neg_sd: number; pos_sd: number }[];
}

export interface OpPoint {
  threshold: number; tp: number; fp: number; fn: number; tn: number;
  sensitivity: number; specificity: number; ppv: number; npv: number; youden: number;
}

/** One completed screening waiting to leave the phone. */
export interface OutboxItem {
  id: string; createdAt: number; patient: string; district: string;
  risk: number; band: "low" | "watch" | "refer";
  features: Record<string, number>;
  state: "queued" | "sending" | "sent" | "failed";
  bytes: number;
}

interface Ctx {
  ready: boolean;
  model: SandhiModel | null;
  metrics: Metrics | null;
  cohort: Cohort | null;
  online: boolean;
  setOnline: (v: boolean) => void;
  outbox: OutboxItem[];
  enqueue: (i: Omit<OutboxItem, "state" | "id" | "createdAt">) => void;
  flush: () => Promise<void>;
  syncing: boolean;
  serverUp: boolean | null;
  lastSync: number | null;
}

const C = React.createContext<Ctx | null>(null);
const LS_KEY = "sandhi.outbox.v1";

export function SandhiProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = React.useState<SandhiModel | null>(null);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [cohort, setCohort] = React.useState<Cohort | null>(null);
  const [online, setOnline] = React.useState(true);
  const [outbox, setOutbox] = React.useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [serverUp, setServerUp] = React.useState<boolean | null>(null);
  const [lastSync, setLastSync] = React.useState<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const [m, mt, ch] = await Promise.all([
        fetch("/data/model.json").then((r) => r.json()),
        fetch("/data/metrics.json").then((r) => r.json()),
        fetch("/data/cohort.json").then((r) => r.json()),
      ]);
      if (!alive) return;
      setModel(m); setMetrics(mt); setCohort(ch);
    })();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setOutbox(JSON.parse(raw));
    } catch { /* private mode / storage disabled — the app still works */ }
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(outbox)); } catch { /* ignore */ }
  }, [outbox]);

  // Is the Go sync server actually running? Checked, never assumed.
  React.useEffect(() => {
    let alive = true;
    const ping = async () => {
      if (!online) { setServerUp(null); return; }
      try {
        const r = await fetch("http://localhost:8787/healthz", { signal: AbortSignal.timeout(1200) });
        if (alive) setServerUp(r.ok);
      } catch { if (alive) setServerUp(false); }
    };
    ping();
    const t = setInterval(ping, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [online]);

  const enqueue = React.useCallback((i: Omit<OutboxItem, "state" | "id" | "createdAt">) => {
    setOutbox((o) => [
      { ...i, id: `OB-${Date.now().toString(36).toUpperCase()}`, createdAt: Date.now(), state: "queued" },
      ...o,
    ]);
  }, []);

  const flush = React.useCallback(async () => {
    if (!online) return;
    setSyncing(true);
    const queued = outbox.filter((o) => o.state === "queued" || o.state === "failed");
    for (const item of queued) {
      setOutbox((o) => o.map((x) => (x.id === item.id ? { ...x, state: "sending" } : x)));
      let ok = false;
      try {
        const r = await fetch("http://localhost:8787/v1/screenings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: item.id, patient: item.patient, district: item.district,
            risk: item.risk, band: item.band, features: item.features,
            captured_at: new Date(item.createdAt).toISOString(),
          }),
          signal: AbortSignal.timeout(3000),
        });
        ok = r.ok;
      } catch { ok = false; }
      await new Promise((r) => setTimeout(r, 240));
      setOutbox((o) => o.map((x) => (x.id === item.id ? { ...x, state: ok ? "sent" : "failed" } : x)));
    }
    setLastSync(Date.now());
    setSyncing(false);
  }, [online, outbox]);

  const value: Ctx = {
    ready: !!(model && metrics && cohort),
    model, metrics, cohort, online, setOnline, outbox, enqueue, flush, syncing, serverUp, lastSync,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useSandhi() {
  const v = React.useContext(C);
  if (!v) throw new Error("useSandhi outside provider");
  return v;
}

/* ------------------------------------------------------------ formatting -- */
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const num = (v: number, d = 1) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
export const int = (v: number) => Math.round(v).toLocaleString("en-IN");

export const BAND_LABEL: Record<string, string> = { low: "Low", watch: "Watch", refer: "Refer" };
export const BAND_CHIP: Record<string, string> = { low: "chip-sage", watch: "chip-amber", refer: "chip-clay" };
export const BAND_VAR: Record<string, string> = {
  low: "var(--sage-ink)", watch: "var(--amber-ink)", refer: "var(--clay-ink)",
};
export const BAND_BG: Record<string, string> = {
  low: "var(--sage-bg)", watch: "var(--amber-bg)", refer: "var(--clay-bg)",
};

/** Human labels for the 30 model inputs — the UI never shows a raw column name. */
export const FEATURE_LABEL: Record<string, string> = {
  cadence_spm: "Cadence", stride_time_s: "Stride time", stride_time_cv_pct: "Stride variability",
  stance_pct: "Stance phase", double_support_pct: "Double support",
  knee_flex_rom_deg: "Knee flexion range", swing_peak_flex_deg: "Peak swing flexion",
  shank_swing_peak_dps: "Shank swing velocity", heelstrike_impact_g: "Heel-strike impact",
  step_asym_pct: "Step asymmetry", gait_speed_est_mps: "Walking speed",
  sts_total_s: "5× sit-to-stand time", sts_mean_rep_s: "Time per stand",
  sts_peak_angvel_dps: "Stand-up peak velocity", sts_smoothness_ldlj: "Movement smoothness",
  sts_rep_cv_pct: "Rep-to-rep variability", sts_trunk_lean_dps: "Trunk lean rate",
  vag_hf_ratio: "Joint high-frequency energy", vag_burst_rate_hz: "Crepitus burst rate",
  vag_spec_entropy: "Joint spectral entropy", vag_rms_x1000: "Joint signal level",
  age: "Age", sex_f: "Female", bmi: "BMI", occ_squat_load: "Occupational squat load",
  stairs_per_day: "Stairs / slopes per day", terrain_slope_idx: "Terrain slope",
  prior_injury: "Prior knee injury", family_hx: "Family history",
  womac_pain: "WOMAC pain", womac_stiff: "WOMAC stiffness",
};

export const FEATURE_UNIT: Record<string, string> = {
  cadence_spm: "steps/min", stride_time_s: "s", stride_time_cv_pct: "%", stance_pct: "%",
  double_support_pct: "%", knee_flex_rom_deg: "°", swing_peak_flex_deg: "°",
  shank_swing_peak_dps: "°/s", heelstrike_impact_g: "g", step_asym_pct: "%",
  gait_speed_est_mps: "m/s", sts_total_s: "s", sts_mean_rep_s: "s",
  sts_peak_angvel_dps: "°/s", sts_smoothness_ldlj: "LDLJ", sts_rep_cv_pct: "%",
  sts_trunk_lean_dps: "°/s", vag_hf_ratio: "", vag_burst_rate_hz: "Hz",
  vag_spec_entropy: "", vag_rms_x1000: "mV", age: "yr", sex_f: "", bmi: "kg/m²",
  occ_squat_load: "/3", stairs_per_day: "", terrain_slope_idx: "", prior_injury: "",
  family_hx: "", womac_pain: "/20", womac_stiff: "/8",
};

/** Renders one feature value the way a person would read it. */
export function formatFeature(k: string, v: number) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  if (k === "sex_f" || k === "prior_injury" || k === "family_hx") return v > 0.5 ? "Yes" : "No";
  if (k === "stairs_per_day") return Math.round(v).toString();
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

export const CHANNEL_LABEL: Record<string, string> = {
  gait: "Gait IMU", sts: "Sit-to-stand", acoustic: "Joint acoustic", intake: "Intake form",
};
export const CHANNEL_CHIP: Record<string, string> = {
  gait: "chip-sky", sts: "chip-lilac", acoustic: "chip-blush", intake: "chip-sage",
};
