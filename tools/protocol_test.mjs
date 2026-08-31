/**
 * SANDHI — wire format conformance test.
 *
 *     node tools/protocol_test.mjs
 *
 * Checks three things the firmware and every consumer must agree on exactly:
 *   1. CRC-16/CCITT-FALSE against the standard known-answer vector.
 *   2. Every 20-byte frame round-trips encode -> decode with a valid CRC.
 *   3. Quantisation error never exceeds half an LSB, i.e. we round rather
 *      than truncate. Truncation would put a systematic bias on every gyro
 *      channel, which lands straight in the gait features.
 *
 * Runs against both the web dashboard port (web/lib/dsp/protocol.ts) and the
 * phone port (packages/app/src/lib/protocol.ts). They must encode identically.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = mkdtempSync(join(tmpdir(), "sandhi-proto-"));

let fail = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  if (!ok) fail++;
};

const appDir = join(root, "packages/app");

// Both protocol ports are standalone and are compiled here with the app's
// toolchain (tsc 6 + --ignoreConfig because a tsconfig also lives in cwd).
async function compileEngine(engineDir, relFile) {
  execFileSync(
    "npx",
    ["tsc", "--outDir", out, "--target", "ES2022", "--module", "ESNext",
      "--moduleResolution", "bundler", "--skipLibCheck", "--ignoreConfig",
      join(engineDir, relFile)],
    { cwd: appDir, stdio: "inherit" }
  );
  writeFileSync(join(out, "package.json"), '{"type":"module"}\n');
  return await import(join(out, "protocol.js"));
}

async function testEngine(label, P) {
  console.log(`\nengine: ${label}`);

  const kat = P.crc16(new TextEncoder().encode("123456789"));
  check("CRC-16/CCITT-FALSE known-answer", kat === 0x29b1,
    `0x${kat.toString(16).toUpperCase()} (expect 0x29B1)`);

  const N = 50000;
  let crcFails = 0, worstA = 0, worstG = 0, badHeader = false;
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
    if (d.seq !== s.seq || d.tMs !== s.tMs || d.sensor !== s.sensor || d.flags !== s.flags) badHeader = true;
  }
  check(`${N} frames round-trip with valid CRC`, crcFails === 0, `${crcFails} failures`);
  check("header round-trip", !badHeader);
  check("accel quantisation <= 1/2 LSB", worstA <= 0.5 / P.ACCEL_LSB_PER_G + 1e-12,
    `${worstA.toExponential(2)} g`);
  check("gyro quantisation <= 1/2 LSB", worstG <= 0.5 / P.GYRO_LSB_PER_DPS + 1e-9,
    `${worstG.toFixed(5)} dps`);

  // Both engines must encode a fixed reference sample to identical bytes.
  const REF = { sensor: 1, seq: 3, tMs: 100, ax: 0.5, ay: -0.25, az: 0.9, gx: 10, gy: -20, gz: 30, flags: 0 };
  const ref = P.encodeImuFrame(REF);
  if (refBytes !== null) {
    check("byte-identical encoding vs web's port",
      Buffer.from(ref).equals(Buffer.from(refBytes)), `${label}: ${P.hex(ref)}`);
  } else {
    refBytes = ref;
  }

  // A single flipped bit must be caught, or a corrupt frame becomes a data point.
  let caught = 0;
  for (let i = 0; i < 2000; i++) {
    const f = P.encodeImuFrame({ sensor: 1, seq: i & 0xff, tMs: i, ax: 0.1, ay: 0.2, az: 1,
      gx: 12, gy: -30, gz: 210 });
    f[Math.floor(Math.random() * 18)] ^= 1 << Math.floor(Math.random() * 8);
    if (!P.decodeImuFrame(f).crcOk) caught++;
  }
  check("single-bit corruption detected", caught === 2000, `${caught}/2000 caught`);
}

let refBytes = null;

const Pweb = await compileEngine(join(root, "web"), "lib/dsp/protocol.ts");
await testEngine("web dashboard", Pweb);

const Papp = await compileEngine(appDir, "src/lib/protocol.ts");
await testEngine("app (phone)", Papp);

rmSync(out, { recursive: true, force: true });
console.log(fail ? `\n  ${fail} failing checks\n` : "\n  wire format conforms on both engines.\n");
process.exit(fail ? 1 : 0);