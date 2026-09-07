# SANDHI — AI-Assisted Early Detection of Osteoarthritis (OA) Risk Markers for the North-Eastern Region

**Smart India Hackathon 2026 · Problem Statement SIH26004 · Ministry of DoNER (MDoNER) · Track: Hardware**

**One-line pitch:** "A field kit + offline AI that lets an ASHA worker screen a village for early knee OA in 3 minutes — no doctor, no X-ray, no internet."

---

## 1. What SANDHI is (product / problem)

### The problem it solves
Osteoarthritis (OA) is the most common joint disease and the leading cause of adult disability in India. In the North-Eastern Region (NER), three structural realities converge to make it an overlooked crisis:

1. **HR gap** — rural districts have very few orthopaedic specialists; most cases surface only after decades of silent progression, when cartilage damage is largely irreversible.
2. **Terraced, high-slope terrain** — the region's hills force heavy daily squatting (terrace farming), load carrying, and stair/slope climbing, biomechanically loading the knees far beyond flatland norms.
3. **Connectivity gap** — the villages an ASHA worker visits are precisely where power and internet are absent. Any solution that requires a cloud round-trip or an x-ray machine simply will not work there.

OA is an *early* disease: intervention (weight management, quad strengthening, activity modification, avoiding deep squatting) genuinely changes the trajectory if caught in time. There is no such early-screening tool usable at the point of care in low-infrastructure NER villages today.

### The product
SANDHI is a **field-deployable screening kit** that an ASHA (Accredited Social Health Activist) worker takes village to village. It performs a **non-invasive, 3-minute, kinaesthetic + clinical assessment** and produces an on-device, offline **risk band (Low / Watch / Refer)** plus person-specific preventive guidance — all without a doctor, an X-ray, or an internet connection.

The kit is a hardware/software system with five layers (see `SIH26004-architecture.md`):

1. **Wearable IMU kit (hardware)** — an ESP32 + dual MPU6050 inertial sensor rig strapped to the patient's thigh and shin, streaming 100 Hz IMU data over BLE to the phone.
2. **Mobile app (Expo / React Native)** — drives the assessment flow, captures the BLE stream, extracts features on-device, runs the inference engine, produces the report, and stores to an offline outbox. Also usable in a pure **simulator** mode with no hardware.
3. **CV layer (optional / research)** — `packages/cv/oa_cv` provides computer-vision gait/posture/ROM analysis from a phone camera (pose backends: synthetic, MoveNet, MediaPipe), an alternative or complement to the IMU hardware path.
4. **Web dashboard (Next.js + PWA)** — the district view: a full screening flow mirroring the phone (for demo and parity), a dashboard over the screening cohort, and PWA/offline + outbox sync.
5. **District server (FastAPI + Go)** — accepts batch screening uploads with idempotency (dedupe on `client_id`), re-scores/verifies submissions server-side (tamper check), and stores to a file-backed store.

The core philosophy running through everything is **offline-first and hardware-first**: the entire assessment, scoring, and reporting pipeline works with the radio off, on a phone that costs < ₹10k, powered by a zone that has no mobile signal.

---

## 2. What it does (the assessment flow)

A screening is a **structured, scripted 3-step field assessment**, mirroring the realities of how an ASHA worker can actually interact with a patient. The flow is:

### Step 0 — Intake (clinical questionnaire)
Nine quick questions asked (not guessed) before any sensor capture:

- Name, **Age (years)**
- **Sex** (M/F)
- **Height (cm)** and **Weight (kg)** → computed BMI
- **Main occupation** (mapped to a squat-load score 0–3 and estimated stairs/steps per day)
- **Village / district** (drives a terrain-slope index per district)
- **Prior knee injury / surgery** (yes/no)
- **Family history of knee OA** (yes/no)
- **WOMAC pain** score (0–20, self-report by the patient)
- **WOMAC stiffness** (0–8)

WOMAC (Western Ontario and McMaster Universities Osteoarthritis Index) is a validated knee questionnaire; the app explicitly instructs the worker to ask it, not guess it.

### Step 1 — Fit the kit (~40 s)
The patient stays seated while the worker fits three items in a defined order (a montage screen checks each in turn):

1. **Thigh cuff** — "15 cm above the knee cap, tight enough not to slide" (carries IMU 1 / MPU6050 #1)
2. **Shin cuff** — "10 cm below the knee cap, on the flat of the bone" (carries IMU 2 / MPU6050 #2)
3. **Joint mic** — "inner side of the knee, on skin, no cloth under it" (piezo/acoustic pickup) — *defined by the protocol but intentionally NOT part of the shipped model* (see §9 Honesty).

### Step 2 — Capture (the 3-step test, ~36 s total movement)
1. **Walk** — "Walk normally, 30 seconds, flat ground, usual pace." The app streams both IMUs at 100 Hz.
2. **Sit-to-stand ×5** — "arms crossed, as fast as is comfortable." (~6 s of motion, 5 repetitions.)
3. **Joint sound** — a 6-second "hold still" capture for the acoustic (crepitus) channel. *Present in the protocol; the piezo is never sampled in the shipped model.*

Each phase can be skipped; the app tracks `capture_quality` per modality (walk / STS / vag), which is printed on the report so a reviewing clinician knows exactly what the number rests on.

### Step 3 — On-device scoring (radio off)
1. Raw 20-byte IMU frames are decoded and fused into biomechanical signals (knee flexion angle, thigh/shin gyroscope, shin accelerometer).
2. Features are extracted by the **exact same feature code the model was trained against** (parity-gated, see §7).
3. A plain-TypeScript **decision-tree booster walk** (no TFLite, no ONNX, no WASM) produces a probability.
4. A **rule engine + fused-index fusion policy** produces the printed **risk band** (Low / Watch / Refer) (see §6).
5. A person-specific **preventive guidance** list and **recommendation** are generated.
6. The result (risk score, band, features, timestamps) is saved to an **offline outbox** (SQLite) the moment it is scored — even in airplane mode.

### Step 4 — Report & advice
The result screen shows: the risk band with the score, the band cut-points on a 0–100 gauge, band-specific advice (Low → "No action needed today, re-screen in 12 months"; Watch → "Re-screen in 3 months, teach two exercises"; Refer → "Refer to the PHC, issue a referral slip"), person-specific preventive guidance, the **biggest contributors** (top features driving the score), save-to-outbox, print/PDF, and a mandatory footer: **"Screening aid only. Not a diagnosis of osteoarthritis."**

### Step 5 — Sync (when signal returns)
Finished screenings queue in the phone's SQLite outbox. When connectivity returns (or the worker reaches the district node), a batch POST pushes pending records to the district server (`/v1/screenings`), which dedupes on the idempotent `client_id`, re-scores server-side as a tamper check, and files them. Pending items are tracked with states: `queued → sending → sent | failed`.

---

## 3. How everything works

### 3.1 Hardware & firmware — `packages/firmware/esp32_imu/`

**Board:** ESP32 with two MPU6050 IMUs (one per cuff) and an optional piezo/acoustic input, built with PlatformIO (`platformio.ini`).

**Sensor configuration:**
- Accelerometer: ±4 g full scale → **8192 LSB/g**
- Gyroscope: ±2000 dps full scale → **16.384 LSB/dps**
- Sample rate: **100 Hz per sensor**

**BLE protocol** (`sandhi_proto.h` / `sandhi_proto.cpp`, mirrored byte-for-byte in `packages/app/src/lib/protocol.ts`):
- **Service UUID:** `6e5a0001-b5a3-f393-e0a9-e50e24dcca9e`
- **20-byte IMU frames** at 100 Hz per sensor (thigh + shank)
- Control characteristic (START/STOP/STATUS commands), IMU characteristic (frame stream), and an acoustic characteristic (defined in protocol, **not sampled in the shipped model**)
- **CRC-16/CCITT-FALSE** (poly `0x1021`, init `0xFFFF`) for frame integrity; a status frame carries `sensorMask`, battery mV, free heap, uptime, per-sensor sequence counters, and a `crcOk` flag
- Frames carry a sensor discriminant so the receiver can route thigh vs shank; status vs IMU is disambiguated on decode
- The app connects over BLE via the `@sfourdrinier/react-native-ble-plx` (fork) native module. **BLE requires a development build** (`npx expo run:android`); Expo Go has no BLE module — this is why a `SimKit` exists.

**Important honesty boundary:** the piezo/acoustic characteristic and the `MODE`/`CMD` constants exist in the firmware, and `main.cpp` was edited to remove audio capture — **joint-sound (crepitus) is deliberately NOT part of the shipped screening model.** See §9.

### 3.2 Mobile app — `packages/app/` (Expo / React Native)

**Two kit transports behind one interface** (`src/kits/kit.ts`):
- **BleKit** — talks to the ESP32 over BLE. Requires a dev build. Scans for a device whose name contains "SANDHI" or whose service UUID starts `6E5A0001`, requests MTU 512, subscribes to the IMU and acoustic characteristics, writes control commands, and surfaces `onFrame` / `onAcoustic` / `onStatus` / `onDisconnect` callbacks.
- **SimKit** — replays a synthetic but biomechanically plausible session (from `src/lib/simulator.ts`) so the *entire* flow — capture screens, feature extraction, scoring pipeline, outbox — works in Expo Go with no hardware or in a demo hall. It emits a status frame, then streams simulated walk and sit-to-stand signals. A prominent "SIMULATED data — not a real patient" badge is shown.

Both expose the same `Kit` interface (`connect`, `beginPhase`, `endPhase`, `requestStatus`, `disconnect`, `simSession`); the capture screens and scoring pipeline never know which one is underneath.

**Offline storage** (`src/db.ts`): Expo SQLite (`sandhi.db`, WAL mode) with two tables:
- `screenings` — the **outbox**. A finished screening is written here the instant it is scored. `client_id` is the idempotency key. State: `queued | sending | sent | failed`.
- `settings` — `k`/`v` for the sync URL and UI language.

`flushToServer(serverUrl)` batches pending records and POSTs to `{server}/v1/screenings` with an 8 s timeout; on success the batch flips to `sent`.

**App i18n** (`src/i18n.ts` + `assets/locales/`): the app chrome strings are enumerated for **English, অসমীয়া (Assamese), and हिन्दी (Hindi)**, flipping the whole UI at once. Clinical guidance/recommendation fragments come from the reviewed `oa_core` locale files (`en/as/hi`). Bands map to keys `low → band.LOW`, `watch → band.MODERATE`, `refer → band.HIGH`.

### 3.3 CV layer — `packages/cv/oa_cv/` (research / alternative path)

`oa_cv` provides computer-vision-based gait, posture, and range-of-motion analysis from a phone camera, with pluggable pose backends: a synthetic backend, **MoveNet**, and **MediaPipe**. Modules: `gait.py` (cadence, stance, speed), `pose.py` (pose estimation), `posture.py`, `rom.py` (joint range of motion), `synth.py`, `backends.py`. This is presented as an alternative/complementary sensing modality to the IMU hardware path — the gym of the demo emphasizes that the IMU path is what ships.

### 3.4 Web dashboard — `web/` (Next.js + PWA)

The district-facing web app (8 routes) contains:

- **A full screening flow** (`web/app/screening/page.tsx`) that mirrors the phone experience *in the browser*, running the exact same feature-extraction code and the same on-device model runtime, client-side with no network. The sensor stream is **emulated** (`lib/dsp/simulator.ts`) at the real 100 Hz sampling rate; everything downstream (feature extraction, model, outbox) is the production path. It is explicitly framed as "proof this is not a video." Includes live sensor-channel scopes, live feature extraction ("Features appear here as soon as there is enough signal"), a "Why this score" panel (exact path attribution in log-odds), a printable report, and three demo patient presets (Bhaswati Rabha, 34 / Purnima Lyngdoh, 54 / Uttam Terang, 63).
- **A dashboard** (`web/app/dashboard/page.tsx`) populated from the shipped synthetic cohort.
- **PWA** — installable (manifest + service worker + icons), with offline capability.
- **Outbox sync** — connectivity toggle in the sidebar; when offline the results wait in the outbox.

The web model runtime (`web/lib/model/runtime.ts`) is a **plain-TypeScript tree booster walk** — ~60 lines, no TFLite/ONNX/WASM. A 134-tree / depth-4 model scores in well under a millisecond. It provides `margin`, `sigmoid`, `predict`, `bandOf`, `contributions` (exact Saabas path attribution), and `explain` (top-N features). The decomposition is exact: `margin(x) = base + bias + sum(contributions)`, so the "why" panel always reconciles with the printed score — no approximation, no sampling, no background dataset.

### 3.5 Core engine — `packages/core/oa_core/` (Python, the auditable reference)

This is the **doctor-checkable, rule-engine-primary** scoring core that defines the fusion policy and serves as the authoritative reference implementation.

- **`rules.py`** — the clinical rule engine; produces a 0–100 risk score, domain scores, and named `indicators` (e.g. a NICE clinical-pattern flag). Always runs; cannot fail closed.
- **`risk.py`** — the orchestrator implementing the fusion policy (see §6).
- **`model.py`** — the ML head: sklearn LogisticRegression or shallow GradientBoosting, exported to ONNX for on-device (`onnxruntime-react-native`, ~1 ms, < 50 KB). Two deliberately different operating cuts: a **screening threshold** (tuned for ≥ 90% sensitivity) and a stricter **escalation threshold** (where the model is selective enough that raising a band means something). `OARiskModel` is an always-safe wrapper that falls back to rule-only if no model exists, and refuses to load on feature drift.
- **`features.py`** — the canonical 27-feature contract (`FEATURE_NAMES`, `N_FEATURES`, `to_vector`, `modality_coverage`).
- **`guidance.py`** — `recommendation_keys` and `guidance_keys` producing person-specific prevention advice per band.
- **`schema.py`** — `Assessment`, `RiskBand`, `RiskResult` dataclasses.
- **`i18n.py`** — translation of guidance/recommendation strings across 17 locales; `ne` fully translated, `kha`/`grt` fall back to English.
- **`report.py`** — report generation including `capture_quality`.

### 3.6 District server — `packages/api/oa_api/` (FastAPI + Go)

- **`main.py`** — FastAPI app. Accepts `/v1/screenings` batch POSTs; **re-scores each submission server-side as a tamper check** (verifies the risk/band agree with the features) with optional bearer-token auth (`SANDHI_SYNC_TOKEN`); CORS locked down via `SANDHI_CORS_ORIGINS`.
- **`store.py`** — `FileStore`, a file-backed persistence layer.
- **`models.py`** — pydantic request/response models.

---

## 4. The 27-feature contract (the spine of the whole system)

The single most important invariant in the repo: **three implementations of feature extraction must agree to ~1e-6**, because the same feature vector is computed in Python (training), in TypeScript (web browser), and on the phone (React Native):

| Implementation | Path |
|---|---|
| Python (training / reference) | `ml/features.py` |
| Web (Next.js) | `web/lib/dsp/features.ts` |
| App (React Native) | `packages/app/src/lib/features.ts` |

The contract is **27 features split as 11 gait + 6 sit-to-stand + 10 intake**:

- **11 gait features** — e.g. `cadence_spm` (steps/min), `gait_speed_est_mps`, `stance_pct`, `double_support_pct`, `knee_flex_rom_deg`, `stride_time_cv_pct` (variability), `step_asym_pct`, `shank_swing_peak_dps`, plus a few more derived from the walk.
- **6 STS features** — e.g. `sts_total_s`, `sts_peak_angvel_dps`, `sts_smoothness_ldlj`, `sts_rep_cv_pct`, derived from the sit-to-stand phase.
- **10 intake features** — age, sex, BMI, occupational squat load, stairs per day, terrain slope index, prior injury, family history, WOMAC pain, WOMAC stiffness.

**Enforcement:** `tools/parity_check.mjs` (`npm run parity`) compares the Python and web engines against shared fixtures and fails the build on any drift beyond the ~1e-6 tolerance. The two engines together produced a worst drift of **2.61e-14** across **672 comparisons × 2 engines**; the web UI displays a "parity 1.7e−12" badge.

The reason this matters: **the score the phone prints is only trustworthy if the phone computes the exact same numbers the model was trained on.** Parity is the guarantee behind the phrase "the same code the model was trained against."

---

## 5. ML training: synthetic cohort, honest metrics

### 5.1 The shipped pipeline — `ml/` (custom GBM)

- **`ml/simulator.py`** — generates a **synthetic cohort** of 20,000 simulated screenings, each with intake answers and simulated 30 s walk + 6 s sit-to-stand IMU-channel signals driven by a latent knee-severity and nuisance (sensor gain/noise) factors. Also `lib/dsp/simulator.ts` and `src/lib/simulator.ts` mirror the same signal generator so web and app can synth identical sessions.
- **`ml/gbm.py`** — a **from-scratch Gradient Boosting Machine** (not XGBoost) so the exact inference logic can be ported to the plain-TypeScript on-device walker. Includes `contributions()` (Saabas path method).
- **`ml/train.py`** — trains the booster, does a **stratified split (70/15/15 → train/val/test)**, early-stops on validation (35-round patience), tunes the band cut-points, runs an **ablation study** (intake-only → +gait → +gait+STS → full kit) to quantify exactly how much predictive power the hardware adds, and exports artifacts to `ml/out/`.
- **`ml/train_real.py`** — trains the **real-data baseline** on the Voisard 2025 figshare gait dataset (KOA-vs-healthy, leave-one-subject-out CV).
- **`tools/parity_check.mjs`** — the parity gate tying Python ↔ web ↔ app feature extraction.

**Shipped model hyperparameters** (per `ml/out/model.json` + leading `model.md` summary): **178 trees, max depth 4, learning rate 0.055, L2 λ = 1.2, row subsample 0.85, column subsample 0.80; band cut-points low `0.095`, refer `0.195`.**

**Reported synthetic metrics** (3,002-row held-out test split): **AUC 0.9277, Brier 0.0908.** Ops targets: **refer sensitivity ≥ 0.90** and **low-cut NPV ≥ 0.97** (i.e. a "green" result is genuinely reassuring; missing a case is the expensive error).

### 5.2 The ONNX path — `packages/core` + `ml/oa_core`

Separately, `packages/core/oa_core/model.py` trains sklearn LogisticRegression / shallow GBT exported to ONNX for the rule-engine-primary fusion head — the auditable, coefficient-showable path a clinician can inspect line by line.

### 5.3 ⚠️ HONESTY — read this before quoting numbers anywhere

> **The synthetic metrics (AUC 0.9277, Brier 0.0908) describe how well the simulator's latent ground-truth can be recovered — they are NOT clinical validation.** The cohort is simulated, the "knee OA" label is a synthetic construct, and the numbers prove the *system works structurally* (that the ingest→feature→score→report pipeline recovers a planted relationship), not that it predicts real disease.

This separation is enforced by **`docs/REALITY-MAP.md`**, the honesty guardrail of the project. Real data exists only as the **Voisard 2025 figshare gait baseline** (KOA-vs-healthy, leave-one-subject-out CV) in `ml/train_real.py`. **Never present synthetic numbers as clinical validation** — doing so undercuts the project's credibility with judges and clinicians.

---

## 6. Risk fusion policy (defensible to judges)

The fusion policy in `packages/core/oa_core/risk.py` is deliberately designed and documented for exactly how a judge will probe it. Precisely:

- **The rule engine is primary and always runs.** It contributes **60%** (`RULE_WEIGHT = 0.6`) of the fused index, is fully auditable, and **cannot fail closed**.
- **The ML head contributes 40%** (`ML_WEIGHT = 0.4`), as `100 × probability`, *when a trained model is present*.
- **The printed band is derived from the fused index through the same cut-points** the rule score uses. One number → one band. (An earlier "higher-band-wins" rule produced the indefensible "index 28/100 beside HIGH RISK" and was removed.)
- **The model may escalate at most one band, and only above its escalation cut** — never above the sensitivity (screening) cut. A low, fully-auditable rule score can never print HIGH purely on a probability.
- **The model never de-escalates.** The rule engine sets the floor.
- **Missing modalities never lower the band** — they only reduce `capture_quality`, which is printed on the report so the reviewer knows what the number rests on.
- `version` tracks the fusion (`rules-0.1.0` + optional model version).

Why: *a screening tool's expensive error is a missed case* — so the model gets a voice; but an auditable deterministic core guarantees the report can be defended line by line.

---

## 7. Parity & validation gates (how we prove it works)

- **Feature parity** — `tools/parity_check.mjs` proves Python ↔ web ↔ app extract identical features (worst drift 2.61e-14 over 672 comparisons × 2 engines).
- **Model parity** — `ml/out/parity.json` holds fixtures proving the TypeScript booster walker returns the exact same outputs as the Python training script.
- **ml tests** — 13/13 `ml/tests/test_ml.py` passing.
- **Type/build gates** — web `tsc` + `next build` (8 routes) and app `tsc` clean; PWA install-ready.
- **Offline smoke test** — `scripts/demo_end_to_end.py` drives the end-to-end offline flow.

---

## 8. What connects to what (data flows)

### Hardware → phone
`ESP32 + 2×MPU6050` → 20-byte IMU frames @ 100 Hz, CRC-16/CCITT-FALSE → BLE service `6e5a0001-…` → `BleKit.connect` → `decodeFrame` → captured per-phase signals.

### Signal → features → score
Raw walk + STS signals (from BLE or server-coherent simulator) → `extract(...)` (the 27-feature contract) → `toVector(x)` → `predict(model, x)` (`sigmoid(margin(x))`) → `bandOf` — all on-device, in the browser or on the phone, radio off.

### Features → explanation
`contributions(model, x)` (Saabas) → exact log-odds decomposition `base + bias + Σ contributions` → `explain(...)` top-N → "Why this score" / "Biggest contributors" panels that reconcile with the printed score.

### Phone → server (outbox sync)
Scored result → SQLite `screenings` outbox (`client_id` idempotency key) → on signal, batch POST `/v1/screenings` → server **re-scores as tamper check** → `FileStore` → dashboard. States `queued → sending → sent | failed`.

### Model artifact sync
`ml/out/model.json` (booster + bands + cohort signature) is the *single source of truth*; it is bundled into **both** the web and app bundles (via root `sync-artifacts` script) so the on-device runtime, browser runtime, and training code all consume the identical tree. `ml/out/cohort.json` populates the web dashboard; `metrics.json`, `metrics_real.json`, `parity.json` document the honest numbers.

### The three feature engines
`ml/features.py` (training/reference) ⇄ `web/lib/dsp/features.ts` ⇄ `packages/app/src/lib/features.ts` — gated by `tools/parity_check.mjs`.

---

## 9. Scope boundaries & deliberate omissions (important)

- **Joint-sound / crepitus is NOT in the shipped model.** The acoustic BLE characteristic and piezo `MODE`/`CMD` constants exist in the firmware/protocol, but the kit piezo is **never sampled** and audio was removed from `main.cpp`. The 6 s "joint sound" phase in the fit/flow is defined but not consumed by the model. Any reference to acoustic OA classification is aspirational/research, and must not be presented as shipped capability.
- **The IMU hardware path is what ships**; the CV layer is an alternative/complementary research path.
- **Synthetic cohort is a structural proof, not clinical validation** (see §5.3 and `docs/REALITY-MAP.md`).
- The printed report always carries: "Screening aid only. Not a diagnosis of osteoarthritis."

---

## 10. Repository landmarks & key commands

- `README.md` — overview, benefits/impact framing.
- `SIH26004-architecture.md` — 5-layer architecture; why hardware-first wins.
- `docs/architecture.md`, `docs/REALITY-MAP.md` (honesty guardrail), `docs/research.md` (NER OA epidemiology + references), `docs/impact_feasibility.md` (USP, benefits vs systemic impact).
- `progress.md` — needed-vs-done audit trail with evidence commands.
- ` ml/model` summary of training → `" model.md"` (a file with a **leading space in its name** — see §11).

Key scripts (root `package.json`):
- `npm run train` — retrain the synthetic-cohort booster → `ml/out/`
- `npm run parity` — run the Python↔web↔app feature-parity gate
- `npm run sync-artifacts` — copy `ml/out` artifacts into the web and app bundles
- `npm run dev` / `npm run build` / `npm run server` / `npm run verify` — local dev, build, run the district server, and full-verification

---

## 11. ⚠️ Note for future agents: the `" model.md"` filename oddity

There is a file in the repo root whose name is `" model.md"` — i.e. a **filename with a leading space** (verified: `ls -la` shows `" model.md"`, 2799 bytes). It is effectively a markdown summary of `ml/train.py` produced during an earlier IDE session, and was mined as a content source for this document. Because of the leading space it exists *alongside* a normal `model.md` would not collide with it, and it is easy to miss, glob-miss, or accidentally delete. Do not be confused when looking for it; if any tooling unexpectedly cannot find `model.md`, check for the leading-space sibling first. (`description.md` is intentionally a normal, clean filename.)

---

*This document is the deep-dive companion to the project. For the authoritative claims-boundary of the model, always defer to `docs/REALITY-MAP.md` and `progress.md`.*
