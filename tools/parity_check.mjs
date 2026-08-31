/**
 * SANDHI — Python/TypeScript parity gate.
 *
 * The model is trained by ml/features.py but scored on the phone by
 * web/lib/dsp/features.ts. If those two ever compute a feature differently,
 * the app silently feeds the model out-of-distribution numbers and nobody
 * notices until a patient is misclassified. So: replay identical raw signal
 * fixtures through both and fail loudly on any drift.
 *
 *     node tools/parity_check.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const { extract, toVector, FEATURE_NAMES } = await import(
  join(root, "web/.parity/dsp/features.js")
);
const rt = await import(join(root, "web/.parity/model/runtime.js"));

const fx = JSON.parse(readFileSync(join(root, "ml/out/parity.json"), "utf8"));
const model = JSON.parse(readFileSync(join(root, "ml/out/model.json"), "utf8"));

const TOL_FEATURE = 1e-6;
const TOL_RISK = 1e-6;
const TOL_CONTRIB = 1e-6;

let worstFeature = 0, worstName = "", failures = 0, checks = 0;

fx.cases.forEach((c, ci) => {
  const session = {
    walk: { fs: fx.fs_imu, ...c.walk },
    sts: { fs: fx.fs_imu, ...c.sts },
    vag: { fs: fx.fs_mic, mic: c.vag },
  };
  const got = extract(session, c.intake);

  for (const name of FEATURE_NAMES) {
    checks++;
    const a = got[name], b = c.expected[name];
    const denom = Math.max(1, Math.abs(b));
    const rel = Math.abs(a - b) / denom;
    if (rel > worstFeature) { worstFeature = rel; worstName = name; }
    if (rel > TOL_FEATURE) {
      failures++;
      console.error(
        `  FAIL case ${ci} ${name}: py=${b} ts=${a} (rel ${rel.toExponential(2)})`
      );
    }
  }

  const x = toVector(got);
  const risk = rt.predict(model, x);
  checks++;
  if (Math.abs(risk - c.expected_risk) > TOL_RISK) {
    failures++;
    console.error(`  FAIL case ${ci} risk: py=${c.expected_risk} ts=${risk}`);
  }

  const { c: contrib, bias } = rt.contributions(model, x);
  contrib.forEach((v, i) => {
    checks++;
    if (Math.abs(v - c.expected_contrib[i]) > TOL_CONTRIB) {
      failures++;
      console.error(
        `  FAIL case ${ci} contrib[${FEATURE_NAMES[i]}]: py=${c.expected_contrib[i]} ts=${v}`
      );
    }
  });

  // The attribution must reconstruct the score exactly, or the "why" panel lies.
  const recon = rt.sigmoid(model.base + bias + contrib.reduce((s, v) => s + v, 0));
  checks++;
  if (Math.abs(recon - risk) > 1e-9) {
    failures++;
    console.error(`  FAIL case ${ci} decomposition: ${recon} != ${risk}`);
  }
});

console.log(`\nSANDHI parity: ${checks} comparisons across ${fx.cases.length} fixtures`);
console.log(`  worst feature drift: ${worstFeature.toExponential(2)} (${worstName})`);
if (failures) {
  console.error(`  ${failures} FAILURES — the phone and the trainer disagree.\n`);
  process.exit(1);
}
console.log("  OK — on-device inference is bit-faithful to training.\n");
