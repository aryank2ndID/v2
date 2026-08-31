/**
 * SANDHI — Python/TypeScript parity gate.
 *
 * The model is trained by ml/features.py but scored:
 *   - by the web dashboard (web/lib/dsp/features.ts)
 *   - by the phone app     (packages/app/src/lib/features.ts)
 * If either port ever computes a feature differently, the app silently feeds
 * the model out-of-distribution numbers and nobody notices until a patient is
 * misclassified. So: replay identical raw signal fixtures through ALL engines
 * and fail loudly on any drift.
 *
 *     node tools/parity_check.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const fx = JSON.parse(readFileSync(join(root, "ml/out/parity.json"), "utf8"));
const model = JSON.parse(readFileSync(join(root, "ml/out/model.json"), "utf8"));

const TOL_FEATURE = 1e-6;
const TOL_RISK = 1e-6;
const TOL_CONTRIB = 1e-6;

let worstFeature = 0, worstName = "", failures = 0, checks = 0;

function checkEngine(label, extract, toVector, rt) {
  console.log(`\nengine: ${label}`);
  fx.cases.forEach((c, ci) => {
    const session = {
      walk: { fs: fx.fs_imu, ...c.walk },
      sts: { fs: fx.fs_imu, ...c.sts },
      vag: { fs: fx.fs_mic, mic: c.vag },
    };
    const got = extract(session, c.intake);

    for (const name of c.expected && Object.keys(c.expected)) {
      checks++;
      const a = got[name], b = c.expected[name];
      const denom = Math.max(1, Math.abs(b));
      const rel = Math.abs(a - b) / denom;
      if (rel > worstFeature) { worstFeature = rel; worstName = `${label}:${name}`; }
      if (rel > TOL_FEATURE) {
        failures++;
        console.error(
          `  FAIL ${label} case ${ci} ${name}: py=${b} ts=${a} (rel ${rel.toExponential(2)})`
        );
      }
    }

    const x = toVector(got);
    const risk = rt.predict(model, x);
    checks++;
    if (Math.abs(risk - c.expected_risk) > TOL_RISK) {
      failures++;
      console.error(`  FAIL ${label} case ${ci} risk: py=${c.expected_risk} ts=${risk}`);
    }

    const { c: contrib, bias } = rt.contributions(model, x);
    contrib.forEach((v, i) => {
      checks++;
      if (Math.abs(v - c.expected_contrib[i]) > TOL_CONTRIB) {
        failures++;
        console.error(
          `  FAIL ${label} case ${ci} contrib[${Object.keys(c.expected)[i]}]: py=${c.expected_contrib[i]} ts=${v}`
        );
      }
    });

    // The attribution must reconstruct the score exactly, or the "why" panel lies.
    const recon = rt.sigmoid(model.base + bias + contrib.reduce((s, v) => s + v, 0));
    checks++;
    if (Math.abs(recon - risk) > 1e-9) {
      failures++;
      console.error(`  FAIL ${label} case ${ci} decomposition: ${recon} != ${risk}`);
    }
  });
}

const webFeat = await import(join(root, "web/.parity/dsp/features.js"));
const webRt = await import(join(root, "web/.parity/model/runtime.js"));
checkEngine("web", webFeat.extract, webFeat.toVector, webRt);

// Compile the phone port on demand with the app's own toolchain.
const appDir = join(root, "packages/app");
const appParity = join(appDir, ".parity");
if (!existsSync(join(appParity, "features.js")) || !existsSync(join(appParity, "runtime.js"))) {
  console.log("compiling packages/app/src/lib -> .parity ...");
  execFileSync("npx", [
    "tsc",
    "src/lib/features.ts", "src/lib/runtime.ts", "src/lib/simulator.ts", "src/lib/protocol.ts",
    "--outDir", ".parity",
    "--module", "commonjs",
    "--target", "ES2022",
    "--strict",
    "--skipLibCheck",
    "--ignoreConfig",
  ], { cwd: appDir, stdio: "inherit" });
}
const appFeat = await import(join(appParity, "features.js"));
const appRt = await import(join(appParity, "runtime.js"));
checkEngine("app (phone)", appFeat.extract, appFeat.toVector, appRt);

console.log(`\nSANDHI parity: ${checks} comparisons across ${fx.cases.length} fixtures × 2 engines`);
console.log(`  worst feature drift: ${worstFeature.toExponential(2)} (${worstName})`);
if (failures) {
  console.error(`  ${failures} FAILURES — a phone/dashboard engine disagrees with training.\n`);
  process.exit(1);
}
console.log("  OK — on-device inference is bit-faithful to training.\n");