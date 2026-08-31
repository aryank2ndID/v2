import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Lang, t } from "../i18n";
import { FrameRecorder, Phase } from "../lib/kinematics";
import { SimSession } from "../kits/kit";
import { Kit } from "../kits/kit";
import { Session } from "../lib/features";
import { C, S } from "../theme";
import { Button, Card, ProgressBar, Screen, Title, Wave } from "../ui";

const PHASES: { key: Phase; ui: string; sec: number }[] = [
  { key: "walk", ui: "ui.phase_walk", sec: 30 },
  { key: "sts", ui: "ui.phase_sts", sec: 15 },
  { key: "vag", ui: "ui.phase_vag", sec: 6 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toBars(src: ArrayLike<number>, seconds: number, fs: number): number[] {
  const start = Math.min(src.length, Math.max(0, Math.trunc(src.length * 0.45)));
  const n = Math.min(src.length - start, seconds * fs);
  if (n <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < 96; i++) {
    out.push(src[start + Math.trunc((i / 96) * n)]);
  }
  return out;
}

export function CaptureScreen({
  lang,
  mode,
  kit,
  simSession,
  recorder,
  onComplete,
  onBack,
}: {
  lang: Lang;
  mode: "ble" | "sim";
  kit: Kit;
  simSession: SimSession | null;
  recorder: FrameRecorder;
  onComplete: (session: Session) => void;
  onBack: () => void;
}) {
  const [completed, setCompleted] = useState<Set<Phase>>(new Set());
  const [active, setActive] = useState<Phase | null>(null);
  const [progress, setProgress] = useState(0);
  const [phaseErr, setPhaseErr] = useState("");
  const [waveVals, setWaveVals] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const sampleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const runSeq = useRef(0);

  useEffect(() => {
    if (active && mode === "ble") {
      sampleTimer.current = setInterval(() => {
        setWaveVals([recorder.lastKneeDeg()]);
      }, 60);
    } else if (sampleTimer.current) {
      clearInterval(sampleTimer.current);
      sampleTimer.current = null;
    }
    return () => {
      if (sampleTimer.current) clearInterval(sampleTimer.current);
    };
  }, [active, mode]);

  const allDone = completed.size === PHASES.length;

  function showSimSnippet(key: Phase) {
    if (!simSession) return;
    if (key === "walk") setWaveVals(toBars(simSession.walk.knee_angle, 3, 100));
    else if (key === "sts") setWaveVals(toBars(simSession.sts.thigh_gyro, 3, 100));
    else setWaveVals(toBars(simSession.vag.mic, 0.1, 4000));
  }

  async function runPhase(key: Phase) {
    if (busy) return;
    const seq = ++runSeq.current;
    setBusy(true);
    setPhaseErr("");
    setActive(key);
    setProgress(0);

    try {
      if (mode === "sim") {
        await sleep(220);
        showSimSnippet(key);
      } else {
        recorder.reset(key);
        const info = await kit.beginPhase(key);
        const total = info.durationMs;
        const t0 = Date.now();
        const interval = setInterval(() => setProgress(Math.min(1, (Date.now() - t0) / total)), 100);
        try {
          if (key === "vag") {
            await recorder.waitAcousticDone(15_000);
          } else {
            await sleep(total);
          }
        } finally {
          clearInterval(interval);
        }
        await kit.endPhase();
        setProgress(1);
      }
      if (seq === runSeq.current) {
        const next = new Set(completed);
        next.add(key);
        setCompleted(next);
      }
    } catch (e) {
      setPhaseErr(e instanceof Error ? e.message : "phase failed");
    } finally {
      setActive(null);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title sub="Run each block. The app scores only blocks it actually captured.">
        3-step test
      </Title>

      <Card>
        {PHASES.map((p) => {
          const done = completed.has(p.key);
          const isActive = active === p.key;
          return (
            <View key={p.key} style={styles.block}>
              <View style={styles.blockHead}>
                <View style={styles.blockMain}>
                  <Text style={styles.blockTitle}>• {t(lang, p.ui)}</Text>
                  {isActive ? (
                    <Text style={styles.capture}>
                      {t(lang, "ui.capturing")} {mode === "sim" ? "" : `(${Math.round(progress * p.sec)}s/~${p.sec}s)`}
                    </Text>
                  ) : done ? (
                    <Text style={[styles.doneLabel, { color: C.low }]}>✓ {t(lang, "ui.done")}</Text>
                  ) : (
                    <Text style={styles.todo}>{p.sec}s</Text>
                  )}
                </View>
                {!done && !isActive ? (
                  <Button
                    label={t(lang, "ui.start_phase")}
                    onPress={() => runPhase(p.key)}
                    disabled={active !== null}
                    variant="ghost"
                  />
                ) : null}
              </View>
              {isActive ? <ProgressBar frac={progress} /> : null}
              {done && isActive === false && waveVals.length ? (
                <Wave values={waveVals} />
              ) : null}
            </View>
          );
        })}
      </Card>

      {active && <Wave values={waveVals} />}

      {phaseErr ? (
        <Card tone="refer">
          <Text style={{ color: C.danger }}>{phaseErr}</Text>
        </Card>
      ) : null}

      {mode === "sim" ? (
        <Text style={styles.simNote}>
          {t(lang, "ui.using_sim")}. The waveforms shown are pre-generated
          synthetic signals.
        </Text>
      ) : null}

      <Button label="Back" variant="ghost" onPress={onBack} />

      <Button
        label={t(lang, "ui.score")}
        onPress={() => {
          let session: Session;
          if (mode === "sim" && simSession) {
            session = {
              walk: simSession.walk,
              sts: simSession.sts,
              vag: simSession.vag,
            };
          } else {
            session = {
              walk: recorder.walkSignal(),
              sts: recorder.stsSignal(),
              vag: recorder.vagSignal(),
            };
          }
          onComplete(session);
        }}
        disabled={!allDone}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, paddingVertical: 6 },
  blockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  blockMain: { gap: 2, flexShrink: 1 },
  blockTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  capture: { color: C.sub, fontSize: 12 },
  todo: { color: C.sub, fontSize: 12 },
  doneLabel: { fontSize: 13, fontWeight: "700" },
  simNote: { color: C.warn, fontSize: 12, textAlign: "center" },
});