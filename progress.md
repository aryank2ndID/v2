# SANDHI 26004 — Progress

What is needed vs what is done, as of **2026-09-05**. This is the audit trail:
each "Problem found" row below was verified before being fixed, and every
"Done" claim has a command you can re-run to re-check it.

---

## 1. Audit — problems found and fixed

| # | Problem | Fix | Verified by |
|---|---------|-----|-------------|
| 1 | **Mobile capture forced a 6 s VAG phase the 27-feature model discards** (wasted, confusing step). Two TS2353 type errors because `Session` has only `walk`/`sts`. | Made capture a 2-step test (30 s walk + STS). Dropped VAG from `Capture.tsx` PHASES, the session literal, and the sim-snippet; removed `vag` from `SimSession`/`synthSession`/`createSimSession`. | `npx tsc --noEmit` in `packages/app` → 0 errors |
| 2 | **Server-side ML check silently never ran** — `Assessment(id=…, patient_id=…, features=…)` constructs the wrong object for `oa_core` (needs `assessment_id`, `Patient`, `questionnaire`), the exception is swallowed, so `server_risk_check`/`server_band_check` were always `None`. | Added `GBM.from_json()` to `ml/gbm.py` and made the API score the inbound **flat 27-feature vector** with the same artifact the phone ships (`ml/out/model.json`). Bands read from the artifact, missing features filled 0. | Live POST test: client said risk 0.9/`refer`, server computed 0.0587/`low` → tamper detection works |
| 3 | **Train + consumers drifted.** `npm run train` regenerates `ml/out/*` (now 20k cohort, 178 trees, bands 0.095/0.195) but `sync-artifacts` never copied to `packages/app/assets/model.json`, and `train` didn't sync at all → web + phone quietly shipped an older model. | `sync-artifacts` now also copies `ml/out/model.json` → `packages/app/assets/model.json`; `train` runs `sync-artifacts` on success. | md5 match across `ml/out` == `web/public/data` == `packages/app/assets` for model.json/metrics.json/cohort.json |
| 4 | **`PrintReport` hardcoded band cuts (0.10/0.185)** — stale after retrain (0.095/0.195); plus `web/globals.css` static band widths. | `PrintProps` gained a `bands` prop from the loaded model; print text uses `pct0()` (0.1% resolution). Call sites in `screening` + `registry` pass `model.bands`. | `npx tsc --noEmit` in `web` → 0 errors |
| 5 | **`docs/REALITY-MAP.md` stale** (14k/138 trees/AUC 0.93/0.185). | Regenerated to 20 000 cohort, 178 trees, AUC 0.9277, Brier 0.0908, bands 0.095/0.195, refer op sens 0.886/spec 0.801/PPV 0.643/NPV 0.945; PWA + security sections updated to match shipped state. | Numbers read from `ml/out/metrics.json` / `model.json` |
| 6 | **`web/.parity/**` and `web/tsconfig.tsbuildinfo` tracked in git** (build artifacts). | Added `web/.parity/` and `*.tsbuildinfo` to `.gitignore`; `git rm --cached`. | `git status` clean of those paths |
| 7 | **`ml/train.py` ablation used hardcoded index ranges** `[:11]/[11:17]/[17:]`. | Derived `gait_end`/`sts_end` from `FEATURE_NAMES` (`.index("sts_total_s")`, `.index("age")`). Index sets verified bit-identical to the old hardcode (21/27 cols). | Inline assert + `pytest` |
| 8 | **`ml/train_real.py` data path hardcoded to one machine.** | `SANDHI_REAL_DATA` env override, old path as default. | `ast.parse` + grep |
| 9 | **Dead/unused imports** in web (`IcAlert`/`IcArrow` in dashboard, `num` in dashboard+registry, `SpectrumStrip` in screening). | Removed. | `npx tsc --noEmit` clean; confirmed no other reference |
| 10 | **`oa_core/rules.py` had 16 `"TODO: cite"` sources.** | No fabrication: module docstring now points at `docs/research.md` (§3 curated references) and states the rule for replacing the placeholder. `source` is not rendered to end-users. | grep — placeholders remain honest |
| 11 | **`Patient.patient_id ^NER-` pattern vs `SAN-` ids.** | Investigated, found NOT a bug: the ingest path never builds an `oa_core.Patient`; `req.patient` is a display name, `client_id` is the idempotency key. Removed the dead `oa_core` import + a comment documents this. | Code read |
| 12 | **`_sev_vag`/`_coupling` "dead" in `ml/simulator.py`.** | **Deliberately kept.** They sit ahead of later `rng` draws; removing them shifts the entire simulated cohort and would silently break engine parity + require retraining. Comment added. | Parity still 2.61e-14 across all 672 comparisons × 2 engines |

---

## 2. Needed vs done — the honest sheet

### What the product must deliver
1. A **field-usable OA knee screening**: 30 s walk + 5× STS on a thigh-worn kit, scored on-device, printable report.
2. A **defensible risk model** that doesn't overclaim synthetic numbers.
3. **Offline-first** by design (rural connectivity), i18n for NER languages, secure sync when online.

### Done
| Capability | State | Evidence |
|---|---|---|
| 27-feature GBM model (synthetic) | Done | AUC 0.9277 / Brier 0.0908 on 3 002-row test split; ship artifact = 178 trees, lr 0.055, bands 0.095/0.195 |
| Engine parity (web/app/python) | Done | 672 comparisons × 2 engines, worst drift 2.61e-14 |
| On-device scoring (no network) | Done | web `lib/model/runtime.ts`, app `lib/`; PWA SW precaches model JSON |
| Full screening flow (intake → sensor → features → band → outbox → sync) | Done | verified chain; print/PDF report; preventive guidance card |
| Server-side score cross-check | Done | same-artifact GBM, band from server risk (tamper-visible) |
| CORS lockdown + optional bearer token | Done | `SANDHI_CORS_ORIGINS`, `SANDHI_SYNC_TOKEN`, `allow_credentials=False` |
| PWA install (manifest + SW + icons) | Done | `web/public/manifest.webmanifest`, `sw.js`, generated icons |
| i18n selector (17 langs, EN fallback) | Done | `ne` fully translated; `kha`/`grt` present but fall back to EN |
| Tests | Done | ml `pytest`: 13/13; web `tsc`+`next build` (8 routes); app `tsc` clean |
| Reality documentation | Done | `docs/REALITY-MAP.md` — real vs simulated metrics kept separate |

### Needed but not done (honest)
| Need | Status | Blocker / note |
|---|---|---|
| **Real-device capture** (the BIT) | Not started | No ESP32 attached; sensor channel is wavelet-simulated. This is the single biggest gap — 0.78 locomotion-only AUC generalizes poorly to village subjects until a confirmatory-labeled cohort is recorded |
| Real-world model validation | Not started | Voisard 2025 only; cohorts not age-matched (KOA 69.7y vs healthy 37.7y) → intake-only AUC 1.000 is leakage, not signal |
| `rules.py` per-rule citations | Partially | 16 `"TODO: cite"` remain; `docs/research.md` has the reference list, per-rule mapping unfinished — intentionally not fabricated |
| Transport encryption on API | Not done | Plain HTTP by default; fine for demo, **not** for PHI. Token gate exists but is optional |
| Old 42-feature `artifacts/oa_risk_model.joblib`/`.onnx` | Stale | 42 features, `vag_*`-free, but different contract from the shipped 27 — kept for the rule engine, not for scoring |
| Firmware/ESP32 firmware build | Partial | Kit protocol documented; no device exercised |
| CI pipeline | Not done | All checks runnable locally (`verify`, pytest, parity) but not wired to a CI runner |
| Field testing / IRB / ethics | Not done | Required before any real deployment |

---

## 3. How to re-verify everything

```sh
cd v2
npm run parity                    # 672 × 2, worst drift ~2.6e-14
cd ml && python3 -m pytest tests/ # 13 passed
cd ../web && npx tsc --noEmit && npx next build   # 8 static routes
cd ../packages/app && npx tsc --noEmit           # mobile clean
```

Sync check:
```sh
npx sync-artifacts   # copies ml/out/* -> web/public/data + packages/app/assets
```
Model/metrics/cohort md5s must match across all three locations.

---

_Last regenerated: 2026-09-05 (audit round: find → fix → re-verify)._