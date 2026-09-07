# SANDHI 26004 — Progress

What is needed vs what is done, as of **2026-09-05**. This is the audit trail:
each "Problem found" row below was verified before being fixed, and every
"Done" claim has a command you can re-run to re-check it.

---

## 1. Needed vs done — the honest sheet

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

### Needed but not done
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

## 2. How to re-verify everything

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
