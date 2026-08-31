/**
 * SANDHI — wire format conformance test.
 *
 *     node tools/protocol_test.mjs
 *
 * Checks three things the firmware and the app must agree on exactly:
 *   1. CRC-16/CCITT-FALSE against the standard known-answer vector.
 *   2. Every 20-byte frame round-trips encode -> decode with a valid CRC.
 *   3. Quantisation error never exceeds half an LSB, i.e. we round rather
 *      than truncate. Truncation would put a systematic bias on every gyro
 *      channel, which lands straight in the gait features.
 */
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "sandhi-proto-"));
execSync(
  `npx tsc --outDir ${out} --target ES2022 --module esnext --moduleResolution bundler lib/dsp/protocol.ts`,
  { cwd: join(root, "web"), stdio: "inherit" }
);
writeFileSync(join(out, "package.json"), '{"type":"module"}\n');
const P = await import(join(out, "protocol.js"));

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) fail++;
};

const kat = P.crc16(new TextEncoder().encode("123456789"));
check("CRC-16/CCITT-FALSE known-answer", kat === 0x29b1,
  `0x${kat.toString(16).toUpperCase()} (expect 0x29B1)`);

const N = 50000;
let crcFails = 0, worstA = 0, worstG = 0;
for (let i = 0; i < N; i++) {
  const s = {
    sensor: (i % 3) + 1, seq: i & 0xff, tMs: (i * 10) & 0xffff,
    ax: (Math.random() * 8 - 4) * 0.98, ay: (Math.random() * 8 - 4) * 0.98,
    az: (Math.random() * 8 - 4) * 0.98,
    gx: (Math.random() * 4000 - 2000) * 0.98, gy: (Math.random() * 4000 - 2000) * 0.98,
    gz: (Math.random() * 4000 - 2000) * 0.98, flags: i & 7,
  };
  const d = P.decodeImuFrame(P.encodeImuFrame(s));
  if (!d.crcOk) crcFails++;
  worstA = Math.max(worstA, Math.abs(d.ax - s.ax), Math.abs(d.ay - s.ay), Math.abs(d.az - s.az));
  worstG = Math.max(worstG, Math.abs(d.gx - s.gx), Math.abs(d.gy - s.gy), Math.abs(d.gz - s.gz));
  if (d.seq !== s.seq || d.tMs !== s.tMs || d.sensor !== s.sensor || d.flags !== s.flags) {
    check("header round-trip", false, `frame ${i}`);
    break;
  }
}
check(`${N} frames round-trip with valid CRC`, crcFails === 0, `${crcFails} failures`);
check("accel quantisation <= 1/2 LSB", worstA <= 0.5 / P.ACCEL_LSB_PER_G + 1e-12,
  `${worstA.toExponential(2)} g`);
check("gyro quantisation <= 1/2 LSB", worstG <= 0.5 / P.GYRO_LSB_PER_DPS + 1e-9,
  `${worstG.toFixed(5)} dps`);

// A single flipped bit must be caught, or a corrupt frame becomes a data point.
let caught = 0;
for (let i = 0; i < 2000; i++) {
  const f = P.encodeImuFrame({ sensor: 1, seq: i & 0xff, tMs: i, ax: 0.1, ay: 0.2, az: 1,
    gx: 12, gy: -30, gz: 210 });
  f[Math.floor(Math.random() * 18)] ^= 1 << Math.floor(Math.random() * 8);
  if (!P.decodeImuFrame(f).crcOk) caught++;
}
check("single-bit corruption detected", caught === 2000, `${caught}/2000 caught`);

rmSync(out, { recursive: true, force: true });
console.log(fail ? `\n  ${fail} failing checks\n` : "\n  wire format conforms.\n");
process.exit(fail ? 1 : 0);
