# Reality Map

What SANDHI actually is today, what has been measured, and what has only been
simulated. This document exists to stop the demo numbers from being mistaken
for clinical results. **Nothing here replaces an IRB-reviewed clinical study.**

Every claim below links to the artifact it came from so it can be re-checked.

---

## 1. Model performance — two different statements

There are two models in the repo with two different lifespans. Never mix them.

### a) Synthetic benchmark (what the shipped model claims)

| Metric | Value | Source |
|---|---|---|
| Cohort | 20,000 simulated screenings | `ml/simulator.py` |
| Test split | 3,002 rows (train 13,999 / val 2,999) | `ml/out/metrics.json` |
| Model | gradient-boosted trees from scratch | `ml/gbm.py` |
| Trees / depth / lr | 178 / 4 / 0.055 | `ml/out/metrics.json` |
| Features | 27 (11 gait + 6 STS + 10 intake) | `ml/features.py` |
| Test AUC | 0.9277 | `ml/out/metrics.json` |
| Brier | 0.0908 | `ml/out/metrics.json` |
| Bands | low < 0.095, refer ≥ 0.195 | `ml/out/model.json` |

At the **refer** cut (≥ 0.195): sensitivity 0.886, specificity 0.801, PPV 0.643,
NPV 0.945 on the synthetic test split.

**Honest qualifier:** AUC 0.93 measures *how learnable the simulator is*. A
model that can separate training-generated rows tells us the feature pipeline is
consistent and no engine is silently broken — it says almost nothing about
patient accuracy. Do not cite 0.93 to a clinician.

### b) Real-world baseline (research, not the shipped model)

The Voisard 2025 clinical gait dataset (figshare 10.6084/m9.figshare.28806086):
438 trials, 91 subjects (78 symptomatic KOA / 360 healthy), KOA-vs-healthy with
leave-one-subject-out CV.

| Model | AUC [95% CI] | Source |
|---|---|---|
| Gait only (cadence, stride, stance, double-support, step asymmetry, speed, trunk) | 0.776 [0.681–0.907] | `ml/out/metrics_real.json` |
| Intake only (age, sex, BMI, WOMAC pain) | 1.000 [1.000–1.000] | `ml/out/metrics_real.json` |
| Intake + gait | 1.000 [1.000–1.000] | `ml/out/metrics_real.json` |

**Why intake is 1.000 and why we do not ship on it alone:** the cohorts are not
age-matched — KOA mean age 69.7y vs healthy 37.7y, and WOMAC pain is
quasi-definitional of the label. Age + pain alone separates this dataset, so the
real-data AUC saturates. That is *dataset leakage through cohort design*, not a
free lunch.

**Sensor caveat:** the Voisard recording placement (feet/lower-back/head) differs
from the SANDHI kit (thigh/shin IMU). Gait features here use foot-contact timing
and trunk sway. Gait-only AUC 0.78 is the more honest real-world number we have,
and it is not elevated by the intake-confounded features.

**Reproduction:** `python3 ml/train_real.py` (dataset path overridable via
`SANDHI_REAL_DATA`; runs ~16 s; writes `ml/out/metrics_real.json`).

---

## 2. What the browser/phone ships

| Artifact | Where | Size |
|---|---|---|
| Trees + 27-feature contract | `ml/out/model.json` | ~200 KB generated, shipped | 
| Mobile model copy | `packages/app/assets/model.json` | same contract |
| Web runtime copy | `web/public/data/model.json` | synced via `npm run sync-artifacts` |
| Parity (web vs python engines) | `tools/parity_check.mjs` | 672 comparisons × 2 engines, worst drift 2.6e-14 |
| On-device inference | `web/lib/model/runtime.ts` / `packages/app/...` | no network involved |

Parity checked by compiling the web and app DSP to `web/.parity/` + app `.parity/`
and diffing against Python, so the phone and browser compute the same number as
the training suite.

---

## 3. What is simulated (be honest about it)

| Piece | Status | Location |
|---|---|---|
| Sensor stream | **simulated** — no ESP32 attached; wavelet driven at real rates | `web/lib/dsp/simulator.ts`, `packages/app/src/lib/dsp/` |
| Gait/STS waveform capture | **simulated** | `web/app/screening/page.tsx` |
| Registry cohort | **synthetic** — 20,000 records with ground-truth KL | `ml/cohort.json` → `web/public/data/cohort.json` |
| ROM (camera range-of-motion) | **backend unrunnable** — camera backend noted but not executable | kit firmware + app |
| Piezo/VAG acoustic channel | **removed from the model** (27-feature contract has no `vag_*`); residual capture plumbing only | history: `git log` on `ml/features.py` |
| Real-device field capture | **zero** — no deployment recorded | — |

---

## 4. Field-readiness status

- **Offline screening works** for real: intake + simulated sensor → features →
  model → band → outbox → optional sync. Full chain is on-device.
- **PWA/offline install shipped**: `manifest.webmanifest` + service worker
  (`web/public/sw.js`) precaches shell, icons, and the data/model artifacts;
  network-first navigation with cached-shell fallback. The outbox survives page
  reload via `localStorage.sandhi.outbox.v1`.
- **Print / PDF report** added for the screening result and registry record
  (`web/components/PrintReport.tsx`) — same guarantee as `oa_core/report.py`:
  no bare probability, measures + risk indicator + action + disclaimer. The
  report portals to `document.body` so print CSS can hide the app shell without
  hiding the sheet.
- **i18n**: 17 languages in the selector (incl. Nepali, Khasi, Aʼchik/Garo);
  chrome/nav/hero localized where translator supplied, English fallback
  otherwise. Deep body copy is English by design.
- **Security**: CORS locked to localhost origins by default (env
  `SANDHI_CORS_ORIGINS`, `allow_credentials=False`), and write endpoints
  optionally require a bearer token (`SANDHI_SYNC_TOKEN`). Still not IRB-grade:
  transport is plain HTTP by default and there is no per-record encryption.
  Do not put real PHI behind this until addressed.

## 5. The BIT (Biggest If Thing)

The single most impactful unbuilt capability is **real-device capture**: a
thigh-worn IMU recording the 30 s walk + 5× STS on villagers, compared against
a clinician confirmatory label. Until that exists the 0.78 generalizes only to
a different sensor layout and the 0.93 says nothing about villagers. Everything
else in this repo is scaffolding that makes that measurement cheap once it
happens.

---

_maintained by the SIH26004 build; numbers regenerated 2026-09-05._