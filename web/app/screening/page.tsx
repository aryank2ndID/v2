"use client";
/**
 * The screening flow, as the ASHA worker sees it.
 *
 * Everything on this page runs client-side with no network: the session is
 * synthesised locally, features are extracted by the same code the model was
 * trained against, and the booster is evaluated in the browser. Turn the
 * connectivity toggle off in the sidebar and nothing about this page changes
 * except that the result waits in the outbox.
 */
import * as React from "react";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, SimBadge } from "@/components/ui";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Scope, SpectrumStrip } from "@/components/Scope";
import {
  IcArrow, IcCheck, IcBluetooth, IcBattery, IcWifi, IcWifiOff, IcPlay,
  IcSync, IcUser, IcSpark,
} from "@/components/Icons";
import {
  useSandhi, pct, int, BAND_LABEL, BAND_VAR, BAND_BG, formatFeature,
  FEATURE_LABEL, FEATURE_UNIT, CHANNEL_LABEL, CHANNEL_CHIP,
} from "@/lib/store";
import { Rng, OCCUPATIONS, synthWalk, synthSts, synthVag, type Nuisance } from "@/lib/dsp/simulator";
import { extract, toVector, gaitFeatures, stsFeatures, vagFeatures } from "@/lib/dsp/features";
import { predict, bandOf, explain, contributions } from "@/lib/model/runtime";

type Step = "intake" | "fit" | "capture" | "result";
type Phase = "idle" | "walk" | "sts" | "vag" | "infer" | "done";

const DISTRICT_FALLBACK = { id: "ML-EKH", name: "East Khasi Hills", terrain: 0.82 };

interface Intake {
  name: string; age: number; sex_f: number; height: number; weight: number;
  occIdx: number; prior_injury: number; family_hx: number;
  womac_pain: number; womac_stiff: number; districtId: string;
}

const BLANK: Intake = {
  name: "", age: 52, sex_f: 1, height: 156, weight: 62, occIdx: 0,
  prior_injury: 0, family_hx: 0, womac_pain: 8, womac_stiff: 3,
  districtId: DISTRICT_FALLBACK.id,
};

/* Preset villagers so a demo can be driven without typing. Their intake
   answers are real model inputs; the underlying knee is still simulated. */
const PRESETS: { label: string; hint: string; v: Partial<Intake>; sev: number }[] = [
  { label: "Bhaswati Rabha, 34", hint: "weaver, no complaints", sev: 0.10,
    v: { name: "Bhaswati Rabha", age: 34, sex_f: 1, height: 152, weight: 51, occIdx: 4, prior_injury: 0, family_hx: 0, womac_pain: 2, womac_stiff: 1 } },
  { label: "Purnima Lyngdoh, 54", hint: "terrace farmer, aching knees", sev: 0.55,
    v: { name: "Purnima Lyngdoh", age: 54, sex_f: 1, height: 149, weight: 66, occIdx: 0, prior_injury: 0, family_hx: 1, womac_pain: 11, womac_stiff: 4 } },
  { label: "Uttam Terang, 63", hint: "porter, old injury, stiff", sev: 0.88,
    v: { name: "Uttam Terang", age: 63, sex_f: 0, height: 163, weight: 74, occIdx: 3, prior_injury: 1, family_hx: 1, womac_pain: 16, womac_stiff: 6 } },
];

export default function Screening() {
  const { model, cohort, online, enqueue, flush } = useSandhi();
  const [step, setStep] = React.useState<Step>("intake");
  const [intake, setIntake] = React.useState<Intake>(BLANK);
  const [presetSev, setPresetSev] = React.useState<number | null>(null);

  const [phase, setPhase] = React.useState<Phase>("idle");
  const [t, setT] = React.useState(0);
  const [speed, setSpeed] = React.useState(6);
  const [packets, setPackets] = React.useState(0);
  const [queued, setQueued] = React.useState(false);
  const [inferMs, setInferMs] = React.useState<number | null>(null);
  const [runId, setRunId] = React.useState(0);

  const districts = cohort?.districts ?? [];
  const district = districts.find((d) => d.id === intake.districtId) ?? DISTRICT_FALLBACK;
  const occ = OCCUPATIONS[intake.occIdx];
  const bmi = intake.weight / Math.pow(intake.height / 100, 2);
  const terrain = "terrain" in district ? district.terrain : 0.5;

  /* ---- the session. Generated once per run, then "streamed" like BLE. ----
     The seed is derived from the run counter and the intake answers rather
     than Math.random(): the server and the client must render the same first
     frame, and a reproducible seed also means a demo can be replayed exactly. */
  const session = React.useMemo(() => {
    const seed = (runId + 1) * 7919
      + Math.round(intake.age * 31 + bmi * 97 + intake.occIdx * 613
        + intake.womac_pain * 17 + intake.womac_stiff * 53
        + intake.sex_f * 1201 + intake.prior_injury * 337 + intake.family_hx * 811
        + (presetSev ?? 0) * 10007);
    const rng = new Rng(seed);
    const sev = presetSev ?? (() => {
      const lin = -3.9 + 0.062 * (intake.age - 40) + 0.088 * (bmi - 23) + 0.42 * intake.sex_f
        + 0.3 * occ.squat + 0.0022 * occ.stairs + 0.95 * terrain
        + 0.85 * intake.prior_injury + 0.55 * intake.family_hx + rng.normal(0, 1.2);
      return 1 / (1 + Math.exp(-lin));
    })();
    const cl = (v: number) => Math.min(1, Math.max(0, v));
    const sevFunc = cl(0.66 * sev + 0.18 * Math.max(0, (intake.age - 55) / 35)
      + 0.12 * Math.max(0, (bmi - 27) / 12) + rng.normal(0, 0.17));
    const sevVag = cl(0.78 * sev + rng.normal(0, 0.15));
    const nz: Nuisance = {
      gyro_gain: Math.min(1.2, Math.max(0.8, rng.normal(1, 0.055))),
      accel_gain: Math.min(1.35, Math.max(0.7, rng.normal(1, 0.09))),
      noise_gain: Math.min(2.1, Math.max(0.55, rng.normal(1, 0.22))),
    };
    return {
      walk: synthWalk(rng, sevFunc, nz),
      sts: synthSts(rng, sevFunc, nz),
      vag: synthVag(rng, sevVag, Math.min(1.9, Math.max(0.3, rng.normal(1, 0.3)))),
      nz,
    };
  }, [runId, intake.age, intake.sex_f, bmi, intake.occIdx, intake.prior_injury,
      intake.family_hx, presetSev, terrain, occ.squat, occ.stairs]);

  const stsSeconds = session.sts.thigh_gyro.length / 100;
  const DUR: Record<string, number> = { walk: 30, sts: stsSeconds, vag: 6 };

  React.useEffect(() => {
    if (phase === "idle" || phase === "done" || phase === "infer") return;
    const id = setInterval(() => {
      setT((prev) => {
        const next = prev + 0.05 * speed;
        setPackets((p) => p + Math.round(5 * speed));
        if (next >= DUR[phase]) {
          setPhase((ph) => (ph === "walk" ? "sts" : ph === "sts" ? "vag" : "infer"));
          return 0;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [phase, speed, stsSeconds]);

  const [result, setResult] = React.useState<null | {
    risk: number; band: "low" | "watch" | "refer"; x: number[];
    features: Record<string, number>; top: ReturnType<typeof explain>; bias: number;
  }>(null);

  React.useEffect(() => {
    if (phase !== "infer" || !model) return;
    const id = setTimeout(() => {
      const t0 = performance.now();
      const f = extract(
        { walk: session.walk, sts: session.sts, vag: session.vag },
        {
          age: intake.age, sex_f: intake.sex_f, bmi,
          occ_squat_load: occ.squat, stairs_per_day: occ.stairs,
          terrain_slope_idx: terrain,
          prior_injury: intake.prior_injury, family_hx: intake.family_hx,
          womac_pain: intake.womac_pain, womac_stiff: intake.womac_stiff,
        }
      );
      const x = toVector(f);
      const risk = predict(model, x);
      const { bias } = contributions(model, x);
      setInferMs(performance.now() - t0);
      setResult({ risk, band: bandOf(model, risk), x, features: f, top: explain(model, x, 7), bias });
      setPhase("done");
      setStep("result");
    }, 620);
    return () => clearTimeout(id);
  }, [phase, model]);

  const sampleIdx = Math.floor(t * 100);
  const micIdx = Math.floor(t * 4000);
  const liveVag = React.useMemo(() => {
    if (phase !== "vag" && phase !== "infer" && phase !== "done") return null;
    const end = phase === "vag" ? Math.max(2000, micIdx) : session.vag.mic.length;
    return vagFeatures({ fs: 4000, mic: session.vag.mic.subarray(0, end) });
  }, [phase, Math.floor(micIdx / 2000), session]);

  const reset = () => {
    setStep("intake"); setPhase("idle"); setT(0); setPackets(0);
    setResult(null); setQueued(false); setInferMs(null); setRunId((r) => r + 1);
  };

  const commit = () => {
    if (!result) return;
    enqueue({
      patient: intake.name || "Unnamed",
      district: intake.districtId,
      risk: result.risk, band: result.band,
      features: result.features,
      bytes: 148,
    });
    setQueued(true);
  };

  const totalSeconds = 30 + stsSeconds + 6;
  const elapsed = phase === "walk" ? t : phase === "sts" ? 30 + t
    : phase === "vag" ? 30 + stsSeconds + t : phase === "idle" ? 0 : totalSeconds;

  const walkUpto = phase === "walk" ? sampleIdx : phase === "idle" ? 0 : 3000;

  return (
    <>
      <TopBar
        title="Screening"
        right={
          <>
            <Chip tone="chip-lilac">on-device</Chip>
            {inferMs !== null && <Chip><span className="num">{inferMs.toFixed(1)} ms</span>&nbsp;inference</Chip>}
          </>
        }
      />
      <div className="page">
        <div className="row screen-split" style={{ gap: 22, alignItems: "flex-start" }}>
          <PhoneFrame status={
            <>
              <IcBluetooth size={11} />
              {online ? <IcWifi size={11} /> : <IcWifiOff size={11} />}
              <IcBattery size={13} />
            </>
          }>
            <div style={{ padding: "4px 15px 20px" }}>
              <div className="between" style={{ marginBottom: 12 }}>
                <div className="row" style={{ gap: 7 }}>
                  <div style={{
                    width: 21, height: 21, borderRadius: 6, background: "var(--sky-bg)",
                    border: "1px solid var(--sky-line)", display: "grid", placeItems: "center",
                    fontSize: 10, fontWeight: 700, color: "var(--sky-ink)",
                  }}>স</div>
                  <span style={{ fontWeight: 620, fontSize: 13.5, letterSpacing: "-0.02em" }}>SANDHI</span>
                </div>
                <StepDots step={step} />
              </div>

              {step === "intake" && (
                <IntakeScreen intake={intake} setIntake={setIntake} districts={districts}
                              bmi={bmi} occ={occ} setStep={setStep} setPresetSev={setPresetSev} />
              )}
              {step === "fit" && <FitScreen setStep={setStep} setPhase={setPhase} />}
              {step === "capture" && (
                <CaptureScreen phase={phase} t={t} elapsed={elapsed}
                               totalSeconds={totalSeconds} stsSeconds={stsSeconds} />
              )}
              {step === "result" && model && result && (
                <ResultScreen result={result} intake={intake} reset={reset} commit={commit}
                              queued={queued} online={online} flush={flush} model={model} />
              )}
            </div>
          </PhoneFrame>

          <div className="grow stack" style={{ gap: 14, minWidth: 0 }}>
            <SimBadge
              what="Sensor stream is emulated."
              why="No ESP32 is attached. Waveforms come from lib/dsp/simulator.ts at the real sampling rates (IMU 100 Hz, piezo 4 kHz). Everything downstream — feature extraction, the model, the outbox — is the production path."
            />

            <div className="grid g3">
              <MiniStat label="BLE link" value={phase === "idle" ? "Ready" : "Streaming"}
                        sub={`SANDHI-K1 · ${phase === "idle" ? "−52" : "−58"} dBm`} tone="var(--sky-bg)" />
              <MiniStat label="Frames" value={int(packets)} sub="20-byte notifications" tone="var(--lilac-bg)" />
              <MiniStat label="Session clock" value={`${elapsed.toFixed(1)}s`}
                        sub={`of ${totalSeconds.toFixed(0)}s protocol`} tone="var(--sage-bg)" />
            </div>

            <Card>
              <CardHead
                title="Live sensor channels"
                sub={phase === "idle" ? "Idle — start a capture on the phone" : `Capturing · ${phase}`}
                right={
                  <div className="row" style={{ gap: 6 }}>
                    <span className="tiny dim">Playback</span>
                    {[1, 6, 20].map((s) => (
                      <button key={s} className={`btn btn-sm ${speed === s ? "btn-accent" : ""}`}
                              onClick={() => setSpeed(s)}>{s}×</button>
                    ))}
                  </div>
                }
              />
              <div className="card-bd stack" style={{ gap: 12 }}>
                <div className="grid g2" style={{ gap: 12 }}>
                  <Scope label="Shank gyroscope · z" unit="°/s" height={58} live={phase === "walk"}
                         data={session.walk.shank_gyro.subarray(0, walkUpto)}
                         color="var(--sky-ink)" fill="var(--sky-bg)" />
                  <Scope label="Thigh gyroscope · z" unit="°/s" height={58} live={phase === "walk"}
                         data={session.walk.thigh_gyro.subarray(0, walkUpto)}
                         color="var(--sky-ink)" fill="var(--sky-bg)" />
                  <Scope label="Knee flexion angle" unit="°" height={58} live={phase === "walk"}
                         data={session.walk.knee_angle.subarray(0, walkUpto)}
                         color="var(--sage-ink)" fill="var(--sage-bg)" />
                  <Scope label="Shank accelerometer" unit="g" height={58} live={phase === "walk"}
                         data={session.walk.shank_acc.subarray(0, walkUpto)}
                         color="var(--sage-ink)" fill="var(--sage-bg)" />
                </div>
                <div className="grid g2" style={{ gap: 12 }}>
                  <Scope label="Sit-to-stand · thigh angular velocity" unit="°/s" height={58} window={600}
                         live={phase === "sts"}
                         data={session.sts.thigh_gyro.subarray(0,
                           phase === "sts" ? sampleIdx : (phase === "idle" || phase === "walk") ? 0 : session.sts.thigh_gyro.length)}
                         color="var(--lilac-ink)" fill="var(--lilac-bg)" />
                  <Scope label="Joint microphone · piezo" unit="mV" height={58} window={900}
                         live={phase === "vag"}
                         data={session.vag.mic.subarray(0,
                           phase === "vag" ? micIdx : (phase === "idle" || phase === "walk" || phase === "sts") ? 0 : session.vag.mic.length)}
                         color="var(--blush-ink)" fill="var(--blush-bg)" />
                </div>
                {liveVag && (
                  <div>
                    <div className="between" style={{ marginBottom: 6 }}>
                      <span className="eyebrow">Joint spectrum · 24 bands</span>
                      <span className="tiny dim num">
                        HF ratio {liveVag.vag_hf_ratio.toFixed(3)} · bursts {liveVag.vag_burst_rate_hz.toFixed(2)} Hz
                      </span>
                    </div>
                    <SpectrumStrip bands={liveVag._bands} centers={liveVag._centers} />
                  </div>
                )}
              </div>
            </Card>

            <LiveFeatures phase={phase} session={session} sampleIdx={sampleIdx} result={result} />
            {result && model && <WhyPanel result={result} model={model} />}
          </div>
        </div>
        <style>{`@media (max-width: 1140px){ .screen-split{ flex-direction: column } }`}</style>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- helpers --- */

function MiniStat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone: string }) {
  return (
    <div className="card card-pad" style={{ background: tone }}>
      <div className="eyebrow">{label}</div>
      <div className="serif num" style={{ fontSize: 20, marginTop: 4, lineHeight: 1 }}>{value}</div>
      <div className="tiny dim" style={{ marginTop: 5 }}>{sub}</div>
    </div>
  );
}

/** Features as they become computable — proof this is not a video. */
function LiveFeatures({ phase, session, sampleIdx, result }: {
  phase: Phase;
  session: { walk: any; sts: any; vag: any };
  sampleIdx: number;
  result: { features: Record<string, number> } | null;
}) {
  const partial = React.useMemo(() => {
    if (phase === "idle") return null;
    const out: Record<string, number> = {};
    if (phase === "walk") {
      if (sampleIdx > 400) {
        const e = Math.min(session.walk.knee_angle.length, sampleIdx);
        out.__ = 0;
        Object.assign(out, gaitFeatures({
          fs: 100,
          knee_angle: session.walk.knee_angle.subarray(0, e),
          shank_gyro: session.walk.shank_gyro.subarray(0, e),
          thigh_gyro: session.walk.thigh_gyro.subarray(0, e),
          shank_acc: session.walk.shank_acc.subarray(0, e),
        }));
        delete out.__;
      }
    } else {
      Object.assign(out, gaitFeatures(session.walk));
      if (phase !== "sts") Object.assign(out, stsFeatures(session.sts));
    }
    return out;
  }, [phase, Math.floor(sampleIdx / 100), session]);

  const shown = result?.features ?? partial;

  const groups: [string, string[]][] = [
    ["gait", ["cadence_spm", "gait_speed_est_mps", "stance_pct", "double_support_pct",
              "knee_flex_rom_deg", "stride_time_cv_pct", "step_asym_pct", "shank_swing_peak_dps"]],
    ["sts", ["sts_total_s", "sts_peak_angvel_dps", "sts_smoothness_ldlj", "sts_rep_cv_pct"]],
    ["acoustic", ["vag_burst_rate_hz", "vag_hf_ratio", "vag_spec_entropy", "vag_rms_x1000"]],
  ];

  return (
    <Card>
      <CardHead title="Feature extraction"
                sub="The same code the model was trained against — proven by tools/parity_check.mjs"
                right={<Chip tone="chip-sage"><IcCheck size={11} />parity 1.7e−12</Chip>} />
      <div className="card-bd stack" style={{ gap: 14 }}>
        {!shown || !Object.keys(shown).length ? (
          <div className="tiny dim" style={{ padding: "18px 0", textAlign: "center" }}>
            Features appear here as soon as there is enough signal to compute them.
          </div>
        ) : groups.map(([g, keys]) => {
          const have = keys.filter((k) => shown[k] !== undefined);
          if (!have.length) return null;
          return (
            <div key={g}>
              <div className="row" style={{ gap: 7, marginBottom: 7 }}>
                <Chip tone={CHANNEL_CHIP[g]}>{CHANNEL_LABEL[g]}</Chip>
                <span className="tiny faint">{have.length} of {keys.length} computed</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(146px,1fr))", gap: 7 }}>
                {have.map((k) => (
                  <div key={k} style={{
                    padding: "6px 9px", borderRadius: "var(--r-xs)",
                    background: "var(--surface-2)", border: "1px solid var(--line-soft)",
                  }}>
                    <div className="tiny dim" style={{ lineHeight: 1.25 }}>{FEATURE_LABEL[k]}</div>
                    <div className="num" style={{ fontWeight: 570, fontSize: 13.5, marginTop: 2 }}>
                      {formatFeature(k, shown[k])}{" "}
                      <span className="tiny faint" style={{ fontWeight: 400 }}>{FEATURE_UNIT[k]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function WhyPanel({ result, model }: {
  result: { risk: number; bias: number; top: ReturnType<typeof explain> };
  model: { base: number };
}) {
  const maxAbs = Math.max(...result.top.map((e) => Math.abs(e.contribution)), 1e-6);
  const total = result.top.reduce((s, e) => s + e.contribution, 0);
  return (
    <Card>
      <CardHead
        title="Why this score"
        sub="Exact path attribution in log-odds — base + bias + contributions reconstructs the score"
        icon={<IcSpark size={14} />}
        right={<Chip tone="chip-lilac">top {result.top.length} of 30 inputs</Chip>}
      />
      <div className="card-bd">
        <div className="stack" style={{ gap: 7 }}>
          {result.top.map((e) => {
            const w = (Math.abs(e.contribution) / maxAbs) * 50;
            const up = e.contribution > 0;
            return (
              <div key={e.feature} className="row why-row" style={{ gap: 10, fontSize: 12.6 }}>
                <div style={{ flex: "0 0 172px", textAlign: "right", color: "var(--ink-2)" }}>
                  {FEATURE_LABEL[e.feature] ?? e.feature}
                </div>
                <div className="grow" style={{ position: "relative", height: 15 }}>
                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line-strong)" }} />
                  <div style={{
                    position: "absolute", top: 2, height: 11, borderRadius: 3,
                    background: up ? "var(--clay-line)" : "var(--sage-line)",
                    left: up ? "50%" : `${50 - w}%`, width: `${w}%`,
                    transition: "all .45s var(--ease)",
                  }} />
                </div>
                <div className="num tiny" style={{ flex: "0 0 58px", color: "var(--ink-3)" }}>
                  {formatFeature(e.feature, e.value)}
                </div>
                <div className="num tiny" style={{
                  flex: "0 0 52px", fontWeight: 570,
                  color: up ? "var(--clay-ink)" : "var(--sage-ink)",
                }}>
                  {up ? "+" : ""}{e.contribution.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="row" style={{
          gap: 10, marginTop: 13, paddingTop: 11, borderTop: "1px solid var(--line-soft)",
          fontSize: 12, color: "var(--ink-3)",
        }}>
          <span style={{ flex: "0 0 172px", textAlign: "right" }}>Log-odds</span>
          <span className="grow">
            base {model.base.toFixed(2)} + bias {result.bias.toFixed(2)} + shown {total.toFixed(2)} + the rest
          </span>
          <span className="num" style={{ fontWeight: 600, color: "var(--ink)" }}>→ {pct(result.risk, 1)}</span>
        </div>
      </div>
    </Card>
  );
}

/* ====================================================== PHONE SCREENS ==== */

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ["intake", "fit", "capture", "result"];
  const i = order.indexOf(step);
  return (
    <div className="row" style={{ gap: 4 }}>
      {order.map((s, k) => (
        <span key={s} style={{
          width: k === i ? 14 : 5, height: 5, borderRadius: 99,
          background: k <= i ? "var(--sky-ink)" : "var(--line-strong)",
          transition: "all .3s var(--ease)",
        }} />
      ))}
    </div>
  );
}

function IntakeScreen({ intake, setIntake, districts, bmi, occ, setStep, setPresetSev }: {
  intake: Intake; setIntake: React.Dispatch<React.SetStateAction<Intake>>;
  districts: { id: string; name: string; state: string }[];
  bmi: number; occ: { squat: number; stairs: number };
  setStep: (s: Step) => void; setPresetSev: (v: number | null) => void;
}) {
  const set = <K extends keyof Intake>(k: K, v: Intake[K]) => setIntake((s) => ({ ...s, [k]: v }));
  const edit = <K extends keyof Intake>(k: K, v: Intake[K]) => { set(k, v); setPresetSev(null); };
  return (
    <div className="stack fade-in" style={{ gap: 13 }}>
      <div>
        <h3 style={{ fontSize: 16 }}>New screening</h3>
        <p className="tiny dim" style={{ marginTop: 3, lineHeight: 1.45 }}>
          Nine questions. The kit measures everything else.
        </p>
      </div>

      <div className="card card-quiet" style={{ padding: "9px 10px" }}>
        <div className="eyebrow" style={{ marginBottom: 6, fontSize: 9.6 }}>Demo shortcuts</div>
        <div className="stack" style={{ gap: 5 }}>
          {PRESETS.map((pr) => (
            <button key={pr.label} className="btn btn-sm"
                    style={{ justifyContent: "flex-start", height: "auto", padding: "6px 9px", width: "100%" }}
                    onClick={() => { setIntake((s) => ({ ...s, ...pr.v })); setPresetSev(pr.sev); }}>
              <IcUser size={12} style={{ flex: "0 0 12px", color: "var(--ink-3)" }} />
              <span style={{ textAlign: "left", lineHeight: 1.25, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 560, fontSize: 12.2, whiteSpace: "nowrap" }}>{pr.label}</span>
                <span className="tiny faint" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pr.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <Field label="Name">
        <input className="input" value={intake.name} placeholder="As on the ASHA register"
               onChange={(e) => set("name", e.target.value)} />
      </Field>

      <div className="row" style={{ gap: 9 }}>
        <Field label="Age" grow>
          <input className="input" type="number" value={intake.age}
                 onChange={(e) => edit("age", +e.target.value)} />
        </Field>
        <Field label="Sex" grow>
          <select className="select" value={intake.sex_f}
                  onChange={(e) => edit("sex_f", +e.target.value)}>
            <option value={1}>Female</option><option value={0}>Male</option>
          </select>
        </Field>
      </div>

      <div className="row" style={{ gap: 9 }}>
        <Field label="Height (cm)" grow>
          <input className="input" type="number" value={intake.height}
                 onChange={(e) => edit("height", +e.target.value)} />
        </Field>
        <Field label="Weight (kg)" grow>
          <input className="input" type="number" value={intake.weight}
                 onChange={(e) => edit("weight", +e.target.value)} />
        </Field>
      </div>
      <div className="tiny dim" style={{ marginTop: -6 }}>
        BMI <span className="num" style={{ fontWeight: 600, color: "var(--ink-2)" }}>{bmi.toFixed(1)}</span> kg/m²
      </div>

      <Field label="Main work">
        <select className="select" value={intake.occIdx}
                onChange={(e) => edit("occIdx", +e.target.value)}>
          {OCCUPATIONS.map((o, i) => <option key={o.name} value={i}>{o.name}</option>)}
        </select>
      </Field>
      <div className="tiny dim" style={{ marginTop: -6, lineHeight: 1.4 }}>
        Squat load {occ.squat}/3 · about {occ.stairs} stairs or slope-steps a day
      </div>

      <Field label="Village / district">
        <select className="select" value={intake.districtId}
                onChange={(e) => set("districtId", e.target.value)}>
          {districts.length === 0 && <option value={DISTRICT_FALLBACK.id}>{DISTRICT_FALLBACK.name}</option>}
          {districts.map((d) => <option key={d.id} value={d.id}>{d.name}, {d.state}</option>)}
        </select>
      </Field>

      <div className="row" style={{ gap: 9 }}>
        <YesNo label="Past knee injury" v={intake.prior_injury} on={(v) => edit("prior_injury", v)} />
        <YesNo label="Family history" v={intake.family_hx} on={(v) => edit("family_hx", v)} />
      </div>

      <Slider label="Knee pain this month" v={intake.womac_pain} max={20}
              hint={["none", "mild", "moderate", "severe", "extreme"][Math.min(4, Math.floor(intake.womac_pain / 4.2))]}
              on={(v) => edit("womac_pain", v)} />
      <Slider label="Morning stiffness" v={intake.womac_stiff} max={8}
              hint={["none", "mild", "moderate", "severe", "extreme"][Math.min(4, Math.floor(intake.womac_stiff / 1.7))]}
              on={(v) => edit("womac_stiff", v)} />

      <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 4 }}
              onClick={() => setStep("fit")}>
        Continue<IcArrow size={14} />
      </button>
      <p className="tiny faint" style={{ textAlign: "center", lineHeight: 1.45 }}>
        WOMAC is a validated knee questionnaire. Ask it, do not guess it.
      </p>
    </div>
  );
}

function FitScreen({ setStep, setPhase }: { setStep: (s: Step) => void; setPhase: (p: Phase) => void }) {
  const [checks, setChecks] = React.useState([false, false, false]);
  React.useEffect(() => {
    const ts = [
      setTimeout(() => setChecks([true, false, false]), 550),
      setTimeout(() => setChecks([true, true, false]), 1200),
      setTimeout(() => setChecks([true, true, true]), 1900),
    ];
    return () => ts.forEach(clearTimeout);
  }, []);
  const all = checks.every(Boolean);
  const items: [string, string][] = [
    ["Thigh cuff", "15 cm above the knee cap, tight enough not to slide"],
    ["Shin cuff", "10 cm below the knee cap, on the flat of the bone"],
    ["Joint mic", "inner side of the knee, on skin, no cloth under it"],
  ];
  return (
    <div className="stack fade-in" style={{ gap: 13 }}>
      <div>
        <h3 style={{ fontSize: 16 }}>Fit the kit</h3>
        <p className="tiny dim" style={{ marginTop: 3, lineHeight: 1.45 }}>
          The patient can stay seated. About 40 seconds.
        </p>
      </div>

      <div style={{
        background: "var(--sky-bg)", border: "1px solid var(--sky-line)",
        borderRadius: "var(--r)", padding: "14px 12px", display: "grid", placeItems: "center",
      }}>
        <LegDiagram />
      </div>

      <div className="stack" style={{ gap: 7 }}>
        {items.map(([t, d], i) => (
          <div key={t} className="row" style={{
            gap: 9, padding: "8px 10px", borderRadius: "var(--r-sm)",
            background: checks[i] ? "var(--sage-bg)" : "var(--surface-2)",
            border: `1px solid ${checks[i] ? "var(--sage-line)" : "var(--line)"}`,
            transition: "all .3s var(--ease)", alignItems: "flex-start",
          }}>
            <span style={{
              width: 16, height: 16, borderRadius: 99, flex: "0 0 16px", marginTop: 1,
              display: "grid", placeItems: "center", color: "#fff",
              background: checks[i] ? "var(--sage-ink)" : "var(--line-strong)",
            }}>
              {checks[i] ? <IcCheck size={10} /> : (
                <span className="spin" style={{
                  display: "block", width: 8, height: 8, borderRadius: 99,
                  border: "1.5px solid rgba(255,255,255,.45)", borderTopColor: "#fff",
                }} />
              )}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.6, fontWeight: 560 }}>{t}</div>
              <div className="tiny dim" style={{ lineHeight: 1.4 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={!all}
              onClick={() => { setStep("capture"); setPhase("walk"); }}>
        <IcPlay size={13} />{all ? "Start session" : "Checking sensors…"}
      </button>
    </div>
  );
}

function LegDiagram() {
  return (
    <svg width="132" height="168" viewBox="0 0 132 168" fill="none">
      <path d="M52 8 L52 66 Q52 76 60 82" stroke="var(--sky-ink)" strokeWidth="13" strokeLinecap="round" opacity=".16" />
      <path d="M62 86 Q70 94 70 108 L70 156" stroke="var(--sky-ink)" strokeWidth="11" strokeLinecap="round" opacity=".16" />
      <circle cx="60" cy="83" r="12" fill="var(--surface)" stroke="var(--sky-ink)" strokeWidth="1.6" opacity=".5" />
      <rect x="38" y="42" width="30" height="13" rx="4" fill="var(--surface)" stroke="var(--sky-ink)" strokeWidth="1.6" />
      <text x="74" y="51" fontSize="9" fill="var(--sky-ink)" fontWeight="600">IMU 1</text>
      <rect x="52" y="112" width="30" height="13" rx="4" fill="var(--surface)" stroke="var(--sky-ink)" strokeWidth="1.6" />
      <text x="88" y="121" fontSize="9" fill="var(--sky-ink)" fontWeight="600">IMU 2</text>
      <circle cx="43" cy="86" r="6.5" fill="var(--blush-bg)" stroke="var(--blush-ink)" strokeWidth="1.6" />
      <text x="4" y="89" fontSize="9" fill="var(--blush-ink)" fontWeight="600">mic</text>
      <path d="M49.5 86 h4" stroke="var(--blush-ink)" strokeWidth="1.2" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

function CaptureScreen({ phase, t, elapsed, totalSeconds, stsSeconds }: {
  phase: Phase; t: number; elapsed: number; totalSeconds: number; stsSeconds: number;
}) {
  const stages = [
    { k: "walk", t: "Walk normally", d: "30 seconds, flat ground, usual pace", n: 30 },
    { k: "sts", t: "Sit and stand ×5", d: "arms crossed, as fast as is comfortable", n: stsSeconds },
    { k: "vag", t: "Slow bend and straighten", d: "seated, three slow cycles, stay quiet", n: 6 },
  ];
  const active = stages.findIndex((s) => s.k === phase);
  return (
    <div className="stack fade-in" style={{ gap: 14 }}>
      <div className="between">
        <h3 style={{ fontSize: 16 }}>Capturing</h3>
        <span className="chip chip-clay"><span className="dot pulse" />LIVE</span>
      </div>

      <div style={{ display: "grid", placeItems: "center", padding: "6px 0 2px" }}>
        <ProgressRing value={elapsed / totalSeconds} label={`${Math.round(elapsed)}s`}
                      sub={`of ${Math.round(totalSeconds)}s`} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {stages.map((s, i) => {
          const done = active > i || phase === "infer" || phase === "done";
          const on = active === i;
          return (
            <div key={s.k} style={{
              padding: "10px 12px", borderRadius: "var(--r-sm)",
              background: on ? "var(--sky-bg)" : done ? "var(--sage-bg)" : "var(--surface-2)",
              border: `1px solid ${on ? "var(--sky-line)" : done ? "var(--sage-line)" : "var(--line)"}`,
              transition: "all .3s var(--ease)",
            }}>
              <div className="between">
                <span style={{
                  fontSize: 13, fontWeight: 590,
                  color: on ? "var(--sky-ink)" : done ? "var(--sage-ink)" : "var(--ink-3)",
                }}>{s.t}</span>
                {done ? <IcCheck size={13} style={{ color: "var(--sage-ink)" }} />
                  : on ? <span className="num tiny" style={{ color: "var(--sky-ink)", fontWeight: 620 }}>
                      {Math.max(0, s.n - t).toFixed(0)}s
                    </span> : null}
              </div>
              <div className="tiny dim" style={{ marginTop: 2 }}>{s.d}</div>
              {on && (
                <div className="bar-track" style={{ marginTop: 7, height: 4 }}>
                  <div className="bar-fill" style={{ width: `${(t / s.n) * 100}%`, background: "var(--sky-ink)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {phase === "infer" && (
        <div className="row fade-in" style={{
          gap: 9, padding: "11px 12px", borderRadius: "var(--r-sm)",
          background: "var(--lilac-bg)", border: "1px solid var(--lilac-line)",
        }}>
          <IcSync size={14} className="spin" style={{ color: "var(--lilac-ink)" }} />
          <span style={{ fontSize: 12.6, color: "var(--lilac-ink)", fontWeight: 550 }}>
            Scoring on this phone — nothing leaves the device
          </span>
        </div>
      )}
    </div>
  );
}

function ProgressRing({ value, label, sub }: { value: number; label: string; sub: string }) {
  const r = 52, C = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 132, height: 132 }}>
      <svg width="132" height="132" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--sky-ink)" strokeWidth="9"
                strokeLinecap="round" strokeDasharray={`${Math.min(1, value) * C} ${C}`}
                style={{ transition: "stroke-dasharray .25s linear" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div>
          <div className="serif num" style={{ fontSize: 27, lineHeight: 1 }}>{label}</div>
          <div className="tiny dim" style={{ marginTop: 2 }}>{sub}</div>
        </div>
      </div>
    </div>
  );
}

const ADVICE: Record<string, { head: string; body: string; action: string }> = {
  low: {
    head: "No action needed today",
    body: "Knee signals look typical for this age and this kind of work. Re-screen in twelve months, or sooner if pain starts.",
    action: "Explain the result and move to the next household.",
  },
  watch: {
    head: "Watch — re-screen in three months",
    body: "Some markers sit outside the usual range but not far enough to refer. Quadriceps strengthening, weight management and avoiding deep squatting all help at this stage.",
    action: "Teach the two exercises on the back of the card. Diarise a repeat visit.",
  },
  refer: {
    head: "Refer to the PHC",
    body: "Several markers point towards established joint change. A clinician should examine the knee and decide whether imaging is warranted.",
    action: "Issue a referral slip. Follow up that the visit actually happened.",
  },
};

function ResultScreen({ result, intake, reset, commit, queued, online, flush, model }: {
  result: { risk: number; band: "low" | "watch" | "refer"; top: ReturnType<typeof explain> };
  intake: Intake; reset: () => void; commit: () => void; queued: boolean;
  online: boolean; flush: () => void; model: { bands: { low: number; refer: number } };
}) {
  const a = ADVICE[result.band];
  const borderFor = result.band === "low" ? "var(--sage-line)"
    : result.band === "watch" ? "var(--amber-line)" : "var(--clay-line)";
  return (
    <div className="stack rise" style={{ gap: 13 }}>
      <div style={{
        borderRadius: "var(--r-lg)", padding: "18px 16px",
        background: BAND_BG[result.band], border: `1px solid ${borderFor}`, textAlign: "center",
      }}>
        <div className="eyebrow" style={{ color: BAND_VAR[result.band], opacity: .8 }}>Screening result</div>
        <div className="serif" style={{
          fontSize: 32, lineHeight: 1.1, marginTop: 7,
          color: BAND_VAR[result.band], letterSpacing: "-0.03em",
        }}>{BAND_LABEL[result.band]}</div>
        <div className="num" style={{ fontSize: 12.6, marginTop: 7, color: BAND_VAR[result.band], opacity: .82 }}>
          risk score {pct(result.risk, 1)}
        </div>
        <div style={{ marginTop: 12, position: "relative", height: 7 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 99, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${model.bands.low * 100}%`, background: "var(--sage-line)" }} />
            <div style={{ width: `${(model.bands.refer - model.bands.low) * 100}%`, background: "var(--amber-line)" }} />
            <div style={{ flex: 1, background: "var(--clay-line)" }} />
          </div>
          <div style={{
            position: "absolute", left: `${Math.min(99, result.risk * 100)}%`, top: -3,
            width: 3, height: 13, borderRadius: 2, background: "var(--ink)",
            transform: "translateX(-50%)", boxShadow: "0 0 0 2px rgba(255,255,255,.85)",
          }} />
        </div>
        <div className="between tiny" style={{ marginTop: 5, color: BAND_VAR[result.band], opacity: .62 }}>
          <span>0</span>
          <span className="num">cuts {pct(model.bands.low, 0)} / {pct(model.bands.refer, 0)}</span>
          <span>100</span>
        </div>
      </div>

      <div className="card card-quiet" style={{ padding: "12px 13px" }}>
        <div style={{ fontWeight: 600, fontSize: 13.4 }}>{a.head}</div>
        <p className="small muted" style={{ marginTop: 5, lineHeight: 1.55 }}>{a.body}</p>
        <div className="row" style={{
          gap: 8, marginTop: 10, paddingTop: 9, borderTop: "1px dashed var(--line)", alignItems: "flex-start",
        }}>
          <IcArrow size={13} style={{ color: "var(--ink-3)", marginTop: 2, flex: "0 0 13px" }} />
          <span className="tiny" style={{ lineHeight: 1.5, color: "var(--ink-2)" }}>{a.action}</span>
        </div>
      </div>

      <div className="card" style={{ padding: "11px 13px" }}>
        <div className="eyebrow" style={{ marginBottom: 7 }}>Biggest contributors</div>
        <div className="stack" style={{ gap: 6 }}>
          {result.top.slice(0, 4).map((e) => (
            <div key={e.feature} className="between" style={{ fontSize: 12.2 }}>
              <span className="dim" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {FEATURE_LABEL[e.feature]}
              </span>
              <span className="row num" style={{ gap: 6, flex: "0 0 auto" }}>
                <span style={{ fontWeight: 560 }}>{formatFeature(e.feature, e.value)}</span>
                <span style={{
                  color: e.contribution > 0 ? "var(--clay-ink)" : "var(--sage-ink)",
                  fontWeight: 620, fontSize: 11,
                }}>{e.contribution > 0 ? "↑" : "↓"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-quiet" style={{ padding: "11px 13px" }}>
        <div className="between" style={{ fontSize: 12.4 }}>
          <span className="dim">Record</span>
          <span style={{ fontWeight: 560 }}>{intake.name || "Unnamed"}</span>
        </div>
        <div className="between" style={{ fontSize: 12.4, marginTop: 5 }}>
          <span className="dim">Status</span>
          {queued
            ? <span className="chip chip-sage"><IcCheck size={10} />in outbox</span>
            : <span className="chip">not saved</span>}
        </div>
        {queued && (
          <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.45 }}>
            {online
              ? "Network is up. Press Sync in the sidebar to push it now."
              : "No network. It goes up on its own the next time there is signal."}
          </div>
        )}
      </div>

      <div className="row" style={{ gap: 8 }}>
        {!queued
          ? <button className="btn btn-primary grow" onClick={commit}>Save to outbox</button>
          : <button className="btn btn-accent grow" onClick={flush} disabled={!online}>
              <IcSync size={13} />Sync now
            </button>}
        <button className="btn" onClick={reset}>New</button>
      </div>

      <p className="tiny faint" style={{ textAlign: "center", lineHeight: 1.45, marginTop: 2 }}>
        Screening aid only. Not a diagnosis of osteoarthritis.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- tiny controls --- */

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <div className="field" style={grow ? { flex: 1, minWidth: 0 } : undefined}>
      <span className="label" style={{ fontSize: 11.5 }}>{label}</span>
      {children}
    </div>
  );
}

function YesNo({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <div className="field" style={{ flex: 1, minWidth: 0 }}>
      <span className="label" style={{ fontSize: 11.5 }}>{label}</span>
      <div className="row" style={{ gap: 5 }}>
        {([["No", 0], ["Yes", 1]] as [string, number][]).map(([t, val]) => (
          <button key={t} className={`btn btn-sm ${v === val ? "btn-accent" : ""}`}
                  style={{ flex: 1 }} onClick={() => on(val)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, v, max, hint, on }: {
  label: string; v: number; max: number; hint: string; on: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="between">
        <span className="label" style={{ fontSize: 11.5 }}>{label}</span>
        <span className="tiny" style={{ color: "var(--ink-2)", fontWeight: 560 }}>
          <span className="num">{v.toFixed(0)}</span>/{max} · {hint}
        </span>
      </div>
      <input type="range" min={0} max={max} step={1} value={v} onChange={(e) => on(+e.target.value)} />
    </div>
  );
}
