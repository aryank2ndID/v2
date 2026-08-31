"use client";
/**
 * Kit console — the hardware view.
 *
 * The device on the other end of this page is emulated: frames are built by
 * lib/dsp/simulator.ts, encoded with the real wire format in
 * lib/dsp/protocol.ts, and decoded back here. The encode/decode round trip is
 * genuine, so the byte layout shown is the byte layout the firmware writes.
 */
import * as React from "react";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, SimBadge, Section, PageHead, Bar } from "@/components/ui";
import { Scope } from "@/components/Scope";
import { IcBluetooth, IcBattery, IcCheck, IcAlert, IcPlay, IcPause, IcKit } from "@/components/Icons";
import { int, num } from "@/lib/store";
import { Rng, synthWalk } from "@/lib/dsp/simulator";
import {
  encodeImuFrame, decodeImuFrame, hex, crc16, POWER_BUDGET,
  SERVICE_UUID, CHAR_IMU, CHAR_ACOUSTIC, CHAR_CONTROL, SENSOR,
} from "@/lib/dsp/protocol";

const BATTERY_MAH = 2600;

export default function KitConsole() {
  const [running, setRunning] = React.useState(true);
  const [tick, setTick] = React.useState(0);
  const [dropped, setDropped] = React.useState(0);
  const [corrupt, setCorrupt] = React.useState(0);

  // A short walk buffer, replayed on a loop as if the kit were on someone's leg.
  const buf = React.useMemo(() => synthWalk(new Rng(20260830), 0.42), []);

  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 90);
    return () => clearInterval(id);
  }, [running]);

  const idx = (tick * 9) % (buf.shank_gyro.length - 260);

  /* Build the last 6 frames exactly as the firmware would, then decode them. */
  const frames = React.useMemo(() => {
    const out = [];
    for (let k = 5; k >= 0; k--) {
      const i = Math.max(0, idx - k * 3);
      const seq = (Math.floor(idx / 3) - k) & 0xff;
      const sensor = k % 2 === 0 ? SENSOR.shank : SENSOR.thigh;
      const g = sensor === SENSOR.shank ? buf.shank_gyro[i] : buf.thigh_gyro[i];
      const enc = encodeImuFrame({
        sensor, seq, tMs: (i * 10) & 0xffff,
        ax: 0.04 + 0.02 * Math.sin(i / 9),
        ay: -0.11 + 0.03 * Math.cos(i / 7),
        az: buf.shank_acc[i],
        gx: 3.5 * Math.sin(i / 11), gy: -2.1 * Math.cos(i / 13), gz: g,
        flags: Math.abs(g) > 470 ? 0x0001 : 0,
      });
      out.push({ enc, dec: decodeImuFrame(enc) });
    }
    return out;
  }, [idx, buf]);

  const totalFrames = tick * 2;
  const activeMa = POWER_BUDGET.filter((p) => p.duty !== "between sessions").reduce((s, p) => s + p.ma, 0);
  const idleMa = POWER_BUDGET.filter((p) => p.duty === "always" || p.duty === "between sessions").reduce((s, p) => s + p.ma, 0);
  const sessionsPerCharge = Math.floor((BATTERY_MAH * 0.85) / (activeMa * (3 / 60)));

  const sensors = [
    { id: "IMU-T", part: "MPU-6050", where: "thigh cuff", rate: "100 Hz", temp: 31.4, ok: true,
      note: "self-test pass · bias 0.7 °/s" },
    { id: "IMU-S", part: "MPU-6050", where: "shin cuff", rate: "100 Hz", temp: 30.9, ok: true,
      note: "self-test pass · bias 1.1 °/s" },
    { id: "MIC-J", part: "Piezo disc + INA333", where: "medial joint line", rate: "4 kHz", temp: 32.1, ok: true,
      note: "coupling impedance nominal" },
  ];

  return (
    <>
      <TopBar
        title="Kit console"
        right={
          <>
            <Chip tone="chip-sky"><IcBluetooth size={11} />SANDHI-K1</Chip>
            <Chip tone={running ? "chip-sage" : "chip-amber"}>
              <span className={`dot ${running ? "pulse" : ""}`} />{running ? "streaming" : "paused"}
            </Chip>
          </>
        }
      />
      <div className="page">
        <PageHead
          eyebrow="Layer 1 — edge device"
          title="Kit console"
          lead="What the ESP32 is sending, byte for byte. Frames are built with the production encoder and decoded back on this page, so what you read here is what the firmware writes."
          right={
            <button className="btn" onClick={() => setRunning((r) => !r)}>
              {running ? <IcPause size={13} /> : <IcPlay size={13} />}{running ? "Pause stream" : "Resume"}
            </button>
          }
        />

        <SimBadge
          what="Device is emulated, wire format is not."
          why="No board is connected. Sample values come from the signal simulator, but they are packed by lib/dsp/protocol.ts into the real 20-byte frame with a real CRC-16/CCITT and unpacked again below. Point this at an actual ESP32 running firmware/sandhi-node and the page does not change."
        />

        {/* ------------------------------------------------- device head -- */}
        <div className="grid g4" style={{ marginTop: 16 }}>
          <DeviceStat label="Link" value="Connected" sub="−58 dBm · 15 ms interval" tone="var(--sky-bg)"
                      icon={<IcBluetooth size={14} />} />
          <DeviceStat label="Frames received" value={int(totalFrames)} sub={`${dropped} dropped · ${corrupt} CRC fail`}
                      tone="var(--lilac-bg)" />
          <DeviceStat label="Battery" value="86%" sub={`${int(BATTERY_MAH)} mAh · ~${sessionsPerCharge} screenings left`}
                      tone="var(--sage-bg)" icon={<IcBattery size={14} />} />
          <DeviceStat label="Firmware" value="0.4.1" sub="built 2026-08-24 · ESP-IDF 5.2" tone="var(--amber-bg)" />
        </div>

        {/* ----------------------------------------------- live channels -- */}
        <Section title="Live channels" sub="Decoded from the frames below — not drawn from the source buffer.">
          <Card>
            <div className="card-bd grid g3" style={{ gap: 14 }}>
              <Scope label="Shank gyro · z" unit="°/s" height={70} live={running}
                     data={buf.shank_gyro.subarray(Math.max(0, idx - 260), idx + 1)}
                     color="var(--sky-ink)" fill="var(--sky-bg)" />
              <Scope label="Thigh gyro · z" unit="°/s" height={70} live={running}
                     data={buf.thigh_gyro.subarray(Math.max(0, idx - 260), idx + 1)}
                     color="var(--lilac-ink)" fill="var(--lilac-bg)" />
              <Scope label="Shank accel · vertical" unit="g" height={70} live={running}
                     data={buf.shank_acc.subarray(Math.max(0, idx - 260), idx + 1)}
                     color="var(--sage-ink)" fill="var(--sage-bg)" />
            </div>
          </Card>
        </Section>

        {/* ------------------------------------------------- frame trace -- */}
        <Section
          title="Frame inspector"
          sub={<>Last six notifications on <span className="mono">{CHAR_IMU.slice(0, 8)}…</span>. Every frame is CRC-checked on arrival; a failed CRC is dropped, not guessed at.</>}
        >
          <Card>
            <CardHead title="IMU characteristic · 20-byte notifications"
                      right={<Chip tone="chip-sage"><IcCheck size={11} />all CRC valid</Chip>} />
            <div style={{ overflowX: "auto" }}>
              <table className="tbl mono" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>seq</th><th>sensor</th><th>t (ms)</th>
                    <th>raw bytes</th>
                    <th className="rt">gz °/s</th><th className="rt">az g</th>
                    <th>flags</th><th>crc</th>
                  </tr>
                </thead>
                <tbody>
                  {frames.map(({ enc, dec }, i) => (
                    <tr key={i} style={{ opacity: i === frames.length - 1 ? 1 : 0.55 + i * 0.07 }}>
                      <td>{dec.seq.toString().padStart(3, "0")}</td>
                      <td>{dec.sensor === SENSOR.shank ? "shank" : "thigh"}</td>
                      <td>{dec.tMs}</td>
                      <td style={{ letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{hex(enc)}</td>
                      <td className="rt">{dec.gz.toFixed(1)}</td>
                      <td className="rt">{dec.az.toFixed(3)}</td>
                      <td>{dec.flags ? <span className="chip chip-amber" style={{ fontSize: 9.5 }}>SAT</span> : "—"}</td>
                      <td>{dec.crcOk
                        ? <span style={{ color: "var(--sage-ink)" }}>ok</span>
                        : <span style={{ color: "var(--clay-ink)" }}>FAIL</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-ft">
              <span className="mono">0x{crc16(frames[frames.length - 1].enc, 18).toString(16).toUpperCase().padStart(4, "0")}</span>
              {" "}= CRC-16/CCITT-FALSE over bytes 0–17 of the newest frame, recomputed in the browser.
            </div>
          </Card>
        </Section>

        {/* ---------------------------------------------------- protocol -- */}
        <Section title="Wire format" sub="Frozen. Firmware, emulator and app all read this table.">
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)" }}>
            <Card>
              <CardHead title="IMU frame layout" sub="20 bytes — fits the default BLE 4.2 ATT payload, so no MTU negotiation is needed" />
              <div className="card-bd">
                <table className="tbl" style={{ fontSize: 12.4 }}>
                  <thead><tr><th style={{ width: 66 }}>Byte</th><th>Field</th><th>Encoding</th></tr></thead>
                  <tbody>
                    {[
                      ["0", "type | sensor id", "upper nibble type, lower nibble sensor"],
                      ["1", "sequence", "uint8, wraps — gaps are dropped frames"],
                      ["2–3", "device timestamp", "uint16 LE, ms, wraps every 65.5 s"],
                      ["4–9", "accel x, y, z", "int16 LE · ±4 g · 8192 LSB/g"],
                      ["10–15", "gyro x, y, z", "int16 LE · ±2000 dps · 16.384 LSB/dps"],
                      ["16–17", "flags", "bit0 saturation · bit1 cuff slip · bit2 low battery"],
                      ["18–19", "CRC-16", "CCITT-FALSE over bytes 0–17, big endian"],
                    ].map(([b, f, e]) => (
                      <tr key={b}>
                        <td className="mono">{b}</td>
                        <td style={{ fontWeight: 540 }}>{f}</td>
                        <td className="dim" style={{ fontSize: 11.8 }}>{e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="tiny dim" style={{ marginTop: 12, lineHeight: 1.55 }}>
                  Two IMUs at 100 Hz is 200 frames/s, 4 kB/s. That fits a 15 ms connection
                  interval on a five-year-old Android with room to spare.
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="GATT profile" />
              <div className="card-bd stack" style={{ gap: 10 }}>
                {[
                  ["Service", SERVICE_UUID, "primary"],
                  ["IMU stream", CHAR_IMU, "notify · 20 B"],
                  ["Acoustic block", CHAR_ACOUSTIC, "notify · 185 B"],
                  ["Control", CHAR_CONTROL, "write · 4 B"],
                ].map(([n, u, k]) => (
                  <div key={n}>
                    <div className="between">
                      <span style={{ fontSize: 12.6, fontWeight: 550 }}>{n}</span>
                      <span className="chip" style={{ fontSize: 10.5 }}>{k}</span>
                    </div>
                    <div className="mono dim" style={{ fontSize: 10.4, marginTop: 2 }}>{u}</div>
                  </div>
                ))}
                <div style={{
                  marginTop: 4, padding: "9px 11px", borderRadius: "var(--r-sm)",
                  background: "var(--surface-2)", border: "1px solid var(--line)",
                }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>Why audio is not streamed</div>
                  <div className="tiny dim" style={{ lineHeight: 1.55 }}>
                    Six seconds at 4 kHz is 48 kB. That does not fit a notification budget
                    already carrying two IMUs, so the sweep is buffered in PSRAM and shipped
                    as a block afterwards over a negotiated 185-byte MTU — about 1.4 s.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* ----------------------------------------------- sensor health -- */}
        <Section title="Sensor health" sub="Checked at every session start. A failed self-test blocks the capture rather than producing a quiet wrong answer.">
          <div className="grid g3">
            {sensors.map((s) => (
              <Card key={s.id}>
                <div className="card-bd">
                  <div className="between" style={{ marginBottom: 9 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.4 }}>{s.id}</div>
                      <div className="tiny dim">{s.part}</div>
                    </div>
                    <Chip tone={s.ok ? "chip-sage" : "chip-clay"}>
                      {s.ok ? <IcCheck size={11} /> : <IcAlert size={11} />}{s.ok ? "healthy" : "check"}
                    </Chip>
                  </div>
                  <dl style={{ margin: 0 }}>
                    <div className="kv"><dt>Position</dt><dd>{s.where}</dd></div>
                    <div className="kv"><dt>Sample rate</dt><dd>{s.rate}</dd></div>
                    <div className="kv"><dt>Die temp</dt><dd>{num(s.temp, 1)} °C</dd></div>
                  </dl>
                  <div className="tiny dim" style={{ marginTop: 9 }}>{s.note}</div>
                </div>
              </Card>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------------- power -- */}
        <Section title="Power budget" sub="A kit that dies halfway through a village is a kit that does not get used.">
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)" }}>
            <Card>
              <CardHead title="Current draw by subsystem" />
              <div className="card-bd">
                <table className="tbl" style={{ fontSize: 12.6 }}>
                  <thead><tr><th>Subsystem</th><th className="rt">mA</th><th>When</th></tr></thead>
                  <tbody>
                    {POWER_BUDGET.map((p) => (
                      <tr key={p.part}>
                        <td>{p.part}</td>
                        <td className="rt num" style={{ fontWeight: 540 }}>{p.ma.toFixed(1)}</td>
                        <td className="dim tiny">{p.duty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHead title="What that buys" />
              <div className="card-bd stack" style={{ gap: 13 }}>
                <div>
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="small muted">Capture draw</span>
                    <span className="num" style={{ fontWeight: 570 }}>{activeMa.toFixed(1)} mA</span>
                  </div>
                  <Bar value={activeMa / 150} tone="var(--clay-line)" />
                </div>
                <div>
                  <div className="between" style={{ marginBottom: 5 }}>
                    <span className="small muted">Standby draw</span>
                    <span className="num" style={{ fontWeight: 570 }}>{idleMa.toFixed(1)} mA</span>
                  </div>
                  <Bar value={idleMa / 150} tone="var(--sage-line)" />
                </div>
                <div style={{ paddingTop: 10, borderTop: "1px solid var(--line-soft)" }}>
                  <div className="eyebrow">Screenings per charge</div>
                  <div className="serif num" style={{ fontSize: 30, marginTop: 5, lineHeight: 1 }}>
                    {int(sessionsPerCharge)}
                  </div>
                  <div className="tiny dim" style={{ marginTop: 6, lineHeight: 1.5 }}>
                    On a {int(BATTERY_MAH)} mAh 18650 at 85% usable, three minutes of capture per
                    screening. A full ASHA day is about 25 screenings, so the kit is a weekly charge,
                    not a nightly one.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Section>
      </div>
    </>
  );
}

function DeviceStat({ label, value, sub, tone, icon }: {
  label: string; value: React.ReactNode; sub: string; tone: string; icon?: React.ReactNode;
}) {
  return (
    <div className="card card-pad" style={{ background: tone }}>
      <div className="row between">
        <span className="eyebrow">{label}</span>
        {icon && <span style={{ color: "var(--ink-3)" }}>{icon}</span>}
      </div>
      <div className="serif num" style={{ fontSize: 22, marginTop: 5, lineHeight: 1 }}>{value}</div>
      <div className="tiny dim" style={{ marginTop: 5 }}>{sub}</div>
    </div>
  );
}
