/**
 * SANDHI mobile app - root.
 *
 * A plain screen state machine (no navigator dependency): home -> intake ->
 * connect -> capture -> result, with queue/settings reachable from home.
 * All heavy state lives here; screens are pure props.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "react-native";

import {
  enqueueScreening,
  getSetting,
  initDb,
  listScreenings,
  ScreeningRecord,
  setSetting,
  flushToServer,
} from "./src/db";
import { Lang } from "./src/i18n";
import { FrameRecorder } from "./src/lib/kinematics";
import { Session } from "./src/lib/features";
import { StatusFrame } from "./src/lib/protocol";
import {
  createBleKit,
  createSimKit,
  createSimSession,
  Kit,
  KitHooks,
  SimSession,
} from "./src/kits/kit";
import { defaultIntake, Intake, ScoreOutcome, scoreSession } from "./src/store";
import { HomeScreen } from "./src/screens/Home";
import { IntakeScreen } from "./src/screens/Intake";
import { ConnectScreen, ConnState } from "./src/screens/Connect";
import { CaptureScreen } from "./src/screens/Capture";
import { ResultScreen } from "./src/screens/Result";
import { QueueScreen } from "./src/screens/Queue";
import { SettingsScreen } from "./src/screens/Settings";

type Screen = "home" | "intake" | "connect" | "capture" | "result" | "queue" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<"sim" | "ble">("sim");
  const [serverUrl, setServerUrl] = useState("http://10.0.2.2:8787");
  const [intake, setIntake] = useState<Intake>(defaultIntake());

  const [kit, setKit] = useState<Kit | null>(null);
  const [simSession, setSimSession] = useState<SimSession | null>(null);
  const [connState, setConnState] = useState<ConnState>("idle");
  const [connError, setConnError] = useState("");
  const [status, setStatus] = useState<StatusFrame | null>(null);
  const [framesSeen, setFramesSeen] = useState(0);
  const recorderRef = useRef(new FrameRecorder());

  const [rows, setRows] = useState<ScreeningRecord[]>([]);
  const [outcome, setOutcome] = useState<ScoreOutcome | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "ok" | "fail">("idle");

  const refreshRows = async () => setRows(await listScreenings());

  useEffect(() => {
    (async () => {
      await initDb();
      setLang((await getSetting("lang", "en")) as Lang);
      setServerUrl(await getSetting("server_url", "http://10.0.2.2:8787"));
      setMode((await getSetting("mode", "sim")) as "sim" | "ble");
      await refreshRows();
    })();
  }, []);

  const hooks: KitHooks = useMemo(
    () => ({
      onFrame: (f) => {
        recorderRef.current.onFrame(f);
        setFramesSeen((n) => n + 1);
      },
      onAcoustic: (b) => recorderRef.current.onAcoustic(b),
      onStatus: (s) => setStatus(s),
      onDisconnect: (reason) => {
        void reason;
        setConnState("idle");
      },
    }),
    [],
  );

  async function tearDownOldKit() {
    if (kit) await kit.disconnect().catch(() => undefined);
    setKit(null);
    setSimSession(null);
    setStatus(null);
  }

  async function connectBle() {
    setConnState("connecting");
    setConnError("");
    try {
      await tearDownOldKit();
      const k = createBleKit();
      await k.connect(hooks);
      setKit(k);
      setConnState("connected");
    } catch (e) {
      setConnError(e instanceof Error ? e.message : "connection failed");
      setConnState("error");
    }
  }

  async function useDemo() {
    await tearDownOldKit();
    const s = createSimSession(intake);
    const k = createSimKit(s);
    await k.connect(hooks);
    setSimSession(s);
    setKit(k);
    setConnState("connected");
  }

  function beginCapture(session: Session) {
    const out = scoreSession(intake, session);
    setOutcome(out);
    setSaved(false);
    setSyncState("idle");
    setScreen("result");
  }

  async function saveResult() {
    if (!outcome) return;
    setSaveBusy(true);
    const rec: ScreeningRecord = {
      client_id: outcome.client_id,
      patient: intake.patient,
      district: intake.district,
      risk: outcome.risk,
      band: outcome.band,
      features: outcome.features,
      captured_at: new Date().toISOString(),
      created_at: Date.now(),
      state: "queued",
    };
    await enqueueScreening(rec);
    setSaved(true);
    setSaveBusy(false);
    await refreshRows();
  }

  async function syncAll() {
    setSyncState("syncing");
    const res = await flushToServer(serverUrl);
    setSyncState(res.failed === 0 && res.sent > 0 ? "ok" : res.failed > 0 ? "fail" : "idle");
    await refreshRows();
  }

  function changeLang(l: Lang) {
    setLang(l);
    void setSetting("lang", l);
  }

  function changeMode(m: "sim" | "ble") {
    setMode(m);
    void setSetting("mode", m);
  }

  function changeUrl(u: string) {
    setServerUrl(u);
    void setSetting("server_url", u);
  }

  function startNew() {
    setIntake(defaultIntake());
    setOutcome(null);
    setSaved(false);
    setConnState("idle");
    setScreen("intake");
  }

  const pendingCount = rows.filter((r) => r.state !== "sent").length;
  const sentCount = rows.length - pendingCount;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0d1117" />
      {screen === "home" ? (
        <HomeScreen
          lang={lang}
          pendingCount={pendingCount}
          sentCount={sentCount}
          connected={connState === "connected"}
          demoMode={simSession !== null}
          onStart={startNew}
          onQueue={() => {
            void refreshRows();
            setScreen("queue");
          }}
          onSettings={() => setScreen("settings")}
        />
      ) : screen === "intake" ? (
        <IntakeScreen
          lang={lang}
          intake={intake}
          onChange={(p) => setIntake((prev) => ({ ...prev, ...p }))}
          onNext={() => setScreen("connect")}
        />
      ) : screen === "connect" ? (
        <ConnectScreen
          lang={lang}
          connState={connState}
          connError={connError}
          status={status}
          framesSeen={framesSeen}
          onConnectBle={connectBle}
          onUseDemo={useDemo}
          onContinue={() => setScreen("capture")}
          onBack={() => setScreen("intake")}
        />
      ) : screen === "capture" ? (
        <CaptureScreen
          lang={lang}
          mode={mode}
          kit={kit!}
          simSession={simSession}
          recorder={recorderRef.current}
          onComplete={beginCapture}
          onBack={() => setScreen("connect")}
        />
      ) : screen === "result" && outcome ? (
        <ResultScreen
          lang={lang}
          outcome={outcome}
          saved={saved}
          saveBusy={saveBusy}
          syncState={syncState}
          onSave={saveResult}
          onSync={syncAll}
          onHome={() => setScreen("home")}
          onRetest={() => setScreen("connect")}
          onQueue={() => {
            void refreshRows();
            setScreen("queue");
          }}
        />
      ) : screen === "queue" ? (
        <QueueScreen
          lang={lang}
          items={rows}
          syncState={syncState}
          onSyncAll={syncAll}
          refreshPending={() => void refreshRows()}
          onHome={() => setScreen("home")}
        />
      ) : screen === "settings" ? (
        <SettingsScreen
          lang={lang}
          setLang={changeLang}
          serverUrl={serverUrl}
          setServerUrl={changeUrl}
          mode={mode}
          setMode={changeMode}
          onHome={() => setScreen("home")}
        />
      ) : null}
    </>
  );
}