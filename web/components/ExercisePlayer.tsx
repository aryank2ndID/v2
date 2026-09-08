"use client";
/**
 * The guided-exercise player (USP 4).
 *
 * A looping figure, a rep counter that actually counts, and a talk-back button
 * that reads the steps aloud in the chosen language. No video file, no
 * network — the figure is SVG and the motion is CSS, so it plays identically
 * on a ₹6,000 Android in a village with the radio off.
 */
import * as React from "react";
import type { Exercise, Figure } from "@/lib/data/exercises";
import { tr, trList, speech } from "@/lib/data/exercises";
import { useI18n } from "@/lib/i18n";
import { speak, cancelSpeech, speechSupported, warmVoices, voiceFor } from "@/lib/tts";
import { IcPlay, IcPause, IcSpeaker, IcCheck, IcAlert } from "./Icons";

export function ExercisePlayer({ ex, onDone }: { ex: Exercise; onDone?: () => void }) {
  const { lang } = useI18n();
  const [playing, setPlaying] = React.useState(false);
  const [rep, setRep] = React.useState(0);
  const [talking, setTalking] = React.useState(false);
  const [step, setStep] = React.useState(-1);
  const [voiceNote, setVoiceNote] = React.useState<string | null>(null);

  const steps = trList(ex.steps, lang);

  React.useEffect(() => warmVoices(), []);

  // Reset when the movement changes — a rep count from the last exercise
  // would be worse than no count at all.
  React.useEffect(() => {
    setPlaying(false); setRep(0); setStep(-1); setTalking(false);
    cancelSpeech();
  }, [ex.id]);

  // The rep clock. One tick per `tempo` seconds, stopping at the set.
  React.useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setRep((n) => {
        if (n + 1 >= ex.reps) { setPlaying(false); onDone?.(); return ex.reps; }
        return n + 1;
      });
    }, ex.tempo * 1000);
    return () => clearInterval(t);
  }, [playing, ex.tempo, ex.reps, onDone]);

  // Talk-back walks the script line by line and highlights as it goes.
  const runTalkback = React.useCallback(async () => {
    if (talking) { cancelSpeech(); setTalking(false); setStep(-1); return; }
    const { exact, tag, none } = voiceFor(lang);
    if (!speechSupported() || none) {
      setVoiceNote("No speech voices are installed on this device — the steps stay on screen.");
      return;
    }
    setVoiceNote(exact ? null : `No voice for this language yet — reading in ${tag}.`);
    setTalking(true);
    const lines = speech(ex, lang);
    for (let i = 0; i < lines.length; i++) {
      setStep(i - 1); // line 0 is the name, so step index trails by one
      await speak(lines[i], lang);
    }
    setStep(-1);
    setTalking(false);
  }, [talking, ex, lang]);

  React.useEffect(() => () => cancelSpeech(), []);

  const done = rep >= ex.reps;
  const pct = Math.min(1, rep / ex.reps);

  return (
    <div className="grid g2" style={{ gap: 18, alignItems: "start" }}>
      {/* ------------------------------------------------------- the figure */}
      <div>
        <div className="ex-stage" data-paused={!playing}>
          <FigureArt figure={ex.figure} playing={playing} tempo={ex.tempo} />

          <div style={{ position: "absolute", top: 12, left: 14 }}>
            <span className="chip chip-sage">{ex.dose}</span>
          </div>

          <div className="row" style={{
            position: "absolute", bottom: 12, left: 14, right: 14,
            gap: 10, justifyContent: "space-between",
          }}>
            <button
              className="btn btn-primary"
              onClick={() => { if (done) setRep(0); setPlaying((p) => !p); }}
              aria-label={playing ? "Pause" : done ? "Start again" : "Start"}
            >
              {playing ? <IcPause size={14} /> : <IcPlay size={14} />}
              {playing ? "Pause" : done ? "Again" : "Start"}
            </button>

            <div className="row" style={{ gap: 4, alignItems: "baseline" }}>
              <span className="ex-count" style={{ color: done ? "var(--sage-ink)" : "var(--ink)" }}>{rep}</span>
              <span className="dim" style={{ fontSize: 14, fontWeight: 600 }}>/ {ex.reps}</span>
            </div>
          </div>
        </div>

        <div className="meter" style={{ marginTop: 10 }}>
          <span style={{ width: `${pct * 100}%`, background: done ? "var(--sage-ink)" : "var(--accent)" }} />
        </div>
      </div>

      {/* --------------------------------------------------------- the words */}
      <div>
        <div className="between" style={{ gap: 12, marginBottom: 12 }}>
          <h3 style={{ fontSize: 17 }}>{tr(ex.name, lang)}</h3>
          <button
            className={`btn btn-sm ${talking ? "btn-accent" : ""}`}
            onClick={runTalkback}
            aria-pressed={talking}
            title="Read the steps aloud"
          >
            <IcSpeaker size={13} className={talking ? "pulse" : undefined} />
            {talking ? "Stop" : "Talk back"}
          </button>
        </div>

        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
          {steps.map((s, i) => (
            <li
              key={i}
              className="row"
              style={{
                gap: 10, padding: "9px 11px", borderRadius: "var(--r-sm)",
                background: step === i ? "var(--accent-soft)" : "var(--surface-2)",
                border: `1px solid ${step === i ? "var(--accent)" : "var(--line-soft)"}`,
                transition: "background-color .25s var(--ease), border-color .25s var(--ease)",
              }}
            >
              <span style={{
                width: 21, height: 21, flex: "0 0 21px", borderRadius: 99, display: "grid", placeItems: "center",
                background: step === i ? "var(--accent)" : "var(--surface-3)",
                color: step === i ? "#fff" : "var(--ink-3)",
                fontSize: 11, fontWeight: 700,
              }}>{i + 1}</span>
              <span style={{ fontSize: 13.4, lineHeight: 1.45 }}>{s}</span>
            </li>
          ))}
        </ol>

        <div style={{
          marginTop: 13, padding: "10px 12px", borderRadius: "var(--r-sm)",
          background: "var(--sage-bg)", border: "1px solid var(--sage-line)", color: "var(--sage-ink)",
          fontSize: 12.4, lineHeight: 1.5, display: "flex", gap: 8,
        }}>
          <IcCheck size={14} style={{ flex: "0 0 14px", marginTop: 2 }} />
          {tr(ex.why, lang)}
        </div>

        <div style={{
          marginTop: 8, padding: "10px 12px", borderRadius: "var(--r-sm)",
          background: "var(--amber-bg)", border: "1px solid var(--amber-line)", color: "var(--amber-ink)",
          fontSize: 12.4, lineHeight: 1.5, display: "flex", gap: 8,
        }}>
          <IcAlert size={14} style={{ flex: "0 0 14px", marginTop: 2 }} />
          {tr(ex.caution, lang)}
        </div>

        {voiceNote && <div className="tiny dim" style={{ marginTop: 9 }}>{voiceNote}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- the art --- */
/**
 * Four figures, each a body with one moving part. Drawn at a weight that reads
 * from arm's length, in the same hairline language as the rest of the app.
 *
 * Only the accent-coloured group animates, and it animates with the individual
 * `rotate` / `translate` / `scale` properties rather than a `transform`
 * shorthand — so the keyframes never clobber a static transform on the same
 * element. `transform-box: view-box` pins the rotation origin to viewBox
 * coordinates, which is what the numbers below are written in.
 */
function FigureArt({ figure, playing, tempo }: { figure: Figure; playing: boolean; tempo: number }) {
  // Longhands, not the `animation` shorthand: React warns when a shorthand and
  // one of its longhands (here animation-play-state) are both set on rerender.
  const spin = (name: string, originX?: number, originY?: number): React.CSSProperties => ({
    animationName: name,
    animationDuration: `${tempo}s`,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationPlayState: playing ? "running" : "paused",
    ...(originX !== undefined
      ? { transformBox: "view-box" as const, transformOrigin: `${originX}px ${originY}px` }
      : {}),
  });

  const body = "var(--ink-2)";
  const limb = "var(--accent)";
  const prop = "var(--ink-4)";
  const bw = 5.4;   // body stroke
  const lw = 6.4;   // limb stroke

  /* viewBox is cropped to the drawing's own bounds so the figure fills the
     stage instead of floating in the middle of it. */
  return (
    <svg viewBox="20 16 164 128" width="100%" height="100%" fill="none"
         style={{ display: "block" }}
         strokeLinecap="round" strokeLinejoin="round" aria-hidden>

      {/* ground, common to every figure */}
      <path d="M26 138h152" stroke={prop} strokeWidth="2.4" opacity=".4" />

      {figure === "knee" && (
        <>
          {/* chair: a solid seat and back, so it reads as furniture at a glance */}
          <rect x="42" y="44" width="9" height="50" rx="4.5" fill="var(--sage-mid)" />
          <rect x="42" y="88" width="58" height="9" rx="4.5" fill="var(--sage-mid)" />
          <path d="M47 96v40M95 96v40" stroke={prop} strokeWidth="3" />
          {/* seated body */}
          <circle cx="62" cy="32" r="9" stroke={body} strokeWidth={bw} />
          <path d="M62 41v45M62 86h42" stroke={body} strokeWidth={bw} />
          {/* the swinging shin */}
          <g style={spin("exKnee", 104, 87)}>
            <path d="M104 87v40M104 127h13" stroke={limb} strokeWidth={lw} />
          </g>
          <circle cx="104" cy="87" r="5" fill="var(--surface)" stroke={limb} strokeWidth="2.6" />
        </>
      )}

      {figure === "raise" && (
        <>
          {/* the mat they are lying on */}
          <rect x="26" y="126" width="152" height="7" rx="3.5" fill="var(--sage-mid)" />
          {/* lying body, head at the left */}
          <circle cx="40" cy="112" r="9" stroke={body} strokeWidth={bw} />
          <path d="M49 116h52" stroke={body} strokeWidth={bw} />
          {/* the bent leg that stays put */}
          <path d="M101 116l17-24 19 32" stroke={body} strokeWidth={bw} />
          {/* the straight leg that lifts */}
          <g style={spin("exRaise")}>
            <path d="M101 116h55M156 116l7-11" stroke={limb} strokeWidth={lw} />
          </g>
        </>
      )}

      {figure === "stand" && (
        <>
          {/* the chair being risen out of */}
          <rect x="118" y="42" width="9" height="52" rx="4.5" fill="var(--sage-mid)" />
          <rect x="118" y="88" width="46" height="9" rx="4.5" fill="var(--sage-mid)" />
          <path d="M123 96v40M159 96v40" stroke={prop} strokeWidth="3" />
          {/* the whole body rises and settles */}
          <g style={spin("exStand")}>
            <circle cx="84" cy="34" r="9" stroke={body} strokeWidth={bw} />
            <path d="M84 43v46" stroke={body} strokeWidth={bw} />
            <path d="M84 58h28" stroke={body} strokeWidth="4.6" />
            <path d="M84 89l-9 44M84 89l11 44" stroke={limb} strokeWidth={lw} />
          </g>
        </>
      )}

      {figure === "step" && (
        <>
          {/* the chair back being held for balance */}
          <rect x="128" y="58" width="9" height="78" rx="4.5" fill="var(--sage-mid)" />
          <path d="M118 62h19" stroke={prop} strokeWidth="3" />
          {/* standing body */}
          <circle cx="84" cy="30" r="9" stroke={body} strokeWidth={bw} />
          <path d="M84 39v48M84 54h44" stroke={body} strokeWidth={bw} />
          {/* heels rocking up and down */}
          <g style={spin("exStep", 84, 87)}>
            <path d="M84 87l-8 42M84 87l9 42" stroke={limb} strokeWidth={lw} />
          </g>
        </>
      )}
    </svg>
  );
}
