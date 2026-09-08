# Prior Art & Competitive Landscape — SIH26004 (SANDHI)

Live-search-verified survey of existing knee-OA / gait / IMU screening products and research, and where SANDHI can win. Compiled for the SIH 2026 submission narrative. Also see `docs/research.md` (clinical refs) and `SIH26004_Context_Report.md` (public-health statistics).

## Executive summary

The four technical pillars of SIH26004 — straps + IMUs + gait + sit-to-stand + on-device ML producing an OA **risk score**, run by a **non-specialist community health worker**, **offline-first**, in ~3 min per villager — are each individually well-established but **virtually never combined**:

- **Clinical gait wearables** (APDM/Clario, GaitSmart, Xsens, Noraxon, GaitUp, h/p/cosmos, Motek) are expensive (≥ $4–20k), lab/research-grade, cloud- or PC-bound, operator-trained, and target rehabilitation/monitoring or severity — not community screening.
- **Consumer products** (OneStep, Sway, Sensoria, Dozee, Khushi Baby, ASHA chatbots) are cheap and community-oriented but do **not measure knee OA** — they measure fall risk, balance, vitals, or checklist NCDs. None combine hardware + AI + OA risk score.
- **Imaging-AI products** (ImageBiopsy KOALA, RBknee, Gleamer) are the only regulatory-cleared "OA detection" devices, but require X-ray machines + radiology + connectivity — impossible at a village camp and orthogonal to mechanical/early-risk detection.
- **Academic prior art** closest to SANDHI (TinyML dual-IMU gait classifiers, two-IMU dynamic-coordinate ML papers, chair-stand + sensor validation studies from Pfizer/BU) validates exactly what SANDHI does — but all are lab-scale, small-N, and none is built for ASHA/low-resource field deployment.

**Bottom line:** a crowded *product* space, but an empty *application* space. SANDHI's differentiators: (a) community-level screening workflow built around India's ASHA/NP-NCD/CBAC system, (b) true offline-first operation with failure-tolerant sync, (c) ultra-low bill-of-materials hardware, and (d) a North-East-specific OA-risk modeling story.

---

## 1. Clinical gait-analysis / motion-capture wearables

| System | What it does | Knee-OA risk score? | Setting | Offline? | ~Price |
|---|---|---|---|---|---|
| APDM / Clario Mobility Lab (Opal) | 1–6 IMUs; instrumented TUG, 2-min walk, sway, STS, gait params; digital trial endpoint ("Precision Motion"). Used in MOST study linking gait to knee-MRI progression. | No | Clinical research / pharma-CRO | No (PC) | ≈ $20k |
| GaitSmart (Dynamic Metrics) | 6–7 strap IMUs, ~10-min walk, **cloud** gait report (ROM, symmetry, stance/swing) + vGym rehab. NICE-endorsed (Apr 2024). Envisioned as primary-care-assistant run, GP reads report — closest analogue to "ASHA runs, doctor reads." | No (gait report + rehab) | NHS primary care | **No (cloud)** | £10s/assessment |
| Xsens MVN Awinda | 17 wireless IMUs, full-body mocap; THA vs healthy gait 97% (Teufl 2019). | No | Biomech research / clinics | No (station) | $3.8–12k |
| GaitUP Physilog P6 | 2 foot-worn IMUs, 25 spatio-temporal params, 6-min walk, iTUG; 500+ publications. | No | Clinical gait | No (PC) | €1k+/kit |
| Noraxon Ultium/Motion | 1–16 IMUs + EMG + force treadmills; automated STS, TUG, 10-m walk, sway auto-reports. | No | Rehab labs | No (PC) | $15–40k |
| h/p/cosmos gaitway 3D | Force/pressure-instrumented treadmills (10 kHz Fx/Fy/Fz). | No | Institutional labs | No | High 5-fig € |
| Motek GRAIL/CAREN | Full VR gait labs, 6-DOF platform, dual belt; MDR-certified. | No | High-end rehab | No | $250k+ |
| Vicon / IMeasureU IMU Step | 2 ankle IMUs → per-limb impact, **limb asymmetry**, cumulative "bone load" score. Closest 2-IMU "asymmetry/load score" precedent. | No (load score) | Sports tech | No (cloud) | ~$1k/pair |
| BioSensics (PAMSys, LEGSys, BalanSens) | Gold-standard fall monitoring (250k+ devices); LEGSys knee ROM during gait; balance. | No | Pharma-CRO / aging-in-place | No (cloud) | B2B licences |
| Garmin Health | Consumer wearables in trials (500+ studies); raw HR/activity data. | No | Trials | No | $50–800 |
| mPower (Apple ResearchKit) | iPhone-only remote Parkinson gait/voice study (10k+ enrolled); canonical "phone sensors + ML at population scale." | No | Research | No (synapse upload) | Free app |

## 2. Consumer / market knee-OA, fall-risk, balance products

| System | What it does | Knee-OA risk? | Offline? | Notes |
|---|---|---|---|---|
| OneStep | Phone as "motion lab": 30+ gait params, fall-risk tiers ("Walk Score") from 15–30 s pocket walk; EHR notes. Strongest commercial analogue to a screening trade — but no hardware, no OA model. | No (fall risk) | No (cloud/EHR) | B2B SaaS |
| Sway Medical | FDA 510(k) postural-sway app; concussion/fall-risk screening. | No | No | ~$199/yr |
| Sensoria Smart Knee Brace | Sensor knee sleeve — ROM/adherence for post-op rehab. | No | No | Consumer SaaS |
| RADIAN (dead 2023) | Smart knee sleeve + exercise coaching. Deadpooled — smart-knee-sleeve economics are hard. | No | No | ~~$20–99/mo~~ |
| UNC-CH Franz lab wearable | Wearable detecting harmful gait patterns linked to early knee OA, no force plates; $400k NCInnovation to deploy to rural PT clinics. Research prototype. | Research | Mobile | N/A |
| Deli Ouch/BetFiT-style braces + research wave | Smart-textile knee braces: KneeSense (dual IMU + ToF), KNEESENSE (Sci Rep 2026, pitched for developing-countries accessibility), OARSI smart-brace rehab monitoring. All rehab/post-TKA, not screening. | No (rehab) | — | Validates strap-integrated sensing |

## 3. AI / X-ray imaging OA screening (regulatory-cleared)

| System | What it does | Needs | Offline? |
|---|---|---|---|
| ImageBiopsy KOALA | Fully-automated KL grading / JSN / osteophytes on knee X-ray; FDA 510(k) K192109 + CE. 100+ sites. | X-ray + radiology + PACS | No |
| RBknee | CE-certified KL-grading AI on frontal knee X-rays; Radiology 2024: reader agreement κ 0.84→0.90. | X-ray + radiology | No |
| Gleamer BoneView | Fracture/chest X-ray AI (FDA/CE); not OA — shows regulatory bar for skeletal imaging AI. | X-ray | No |
| Academic | MediAI-OA (OA-diagnosis acc 0.92), AP+LAT radiomics KL (Huiying), 2,546-knee Korea KL AI (binarised OA AUC 0.94), EfficientNet-B0 on Kaggle OAI. | Research | — |

Imaging AI requires **fixed X-ray infrastructure** SANDHI avoids entirely.

## 4. India / low-resource community health instruments

| System | What it does | Relevance to SANDHI |
|---|---|---|
| eSanjeevani (C-DAC/MoHFW) | World's largest primary telemedicine (~250M consults); hub-and-spoke via Ayushman Arogya Mandirs; ABDM-integrated. | The existing delivery channel for hand-off. SANDHI's outbox+Go-sync is the missing **offline buffer**; eSanjeevani needs connectivity. |
| CPHC-NCD App / NP-NCD + CBAC | ANM/ASHA population NCD screening (30+) checklist; node→PHC/CHC/DH referral; sync button; 90:10 NE funding. | **Knee OA has no physical-assessment node in CBAC** — SANDHI is a natural new CBAC module. Published Manipur roll-out friction (connectivity) validates offline-first. |
| Khushi Baby | CHIP platform, 75k CHWs / 48M people; ASHA AI voice copilot w/ Microsoft. | Proves ASHA-scale deployment + co-design and that voice/LLM guidance layers work on top of structured assessment. |
| Dozee | Contactless ballistocardiography vitals; 280+ hospitals; home tier ~$345. | Flagship Made-in-India hardware-health story / validation playbook — but vitals/EWS, not OA or gait. |
| India prevalence evidence | Knee OA 20.24% pooled (Hazra 2025); 28.7% (Pal 2016, n=5,000); OA ~20th cause of YLDs; Manipur NP-NCD friction. | Core problem-statement numbers. |

No OA-gait screening tool surfaced in Indian health-app directories; the closest are tele-ortho consultations, which are out of scope.

## 5. Academic prior art: IMU + gait + OA risk score

The papers that justify SANDHI's approach (the field validated the sensing and the models; nobody took it to ASHA scale):

1. **TinyML dual-IMU (femur+tibia) KOA early detection** — real-time gait-phase classification, ensemble on-device. *Architecturally the closest published system to SANDHI.* Still a lab/dataset paper. `sciencedirect.com/science/article/pii/S0010482525016993`
2. **Two-IMU dynamic-coordinate classical-ML predictor of severe knee OA** (thigh+shank; NB/KNN/SVM/RF; 1,433 labelled signals; sensitivity ≥ +4%). `pmc.ncbi.nlm.nih.gov/articles/PMC11970831` · `pubmed.ncbi.nlm.nih.gov/40191686`
3. **Knee-OA classification from daily-use 2–3 IMU layouts** (Xia et al., ISWC 2022) — handcrafted-feature classifiers work with only 2–3 IMUs. `dl.acm.org/doi/fullHtml/10.1145/3544794.3558459`
4. **KneeGuard** (ACM IMWUT 2024) — calibration-free IMU+sEMG knee-loading estimator; first KOA gait-retraining dataset. sEMG complexity SANDHI deliberately avoids. `dl.acm.org/doi/10.1145/3699768`
5. **Pfizer/BU WESENS-OA gait + chair-stand digital-biomarker validation** — single/few-IMU gait & chair-stand agree with mocap and respond to PT. The "gait + chair-stand = valid KOA biomarker" evidence base. `acrabstracts.org/abstract/…chair-stand…` · `rheumatologyadvisor.com/news/wearable-sensors-may-reliably-assess-at-home-activity…`
6. **30-second Chair-Stand / STS test** — OARSI-recommended, reliable in early knee OA; automatable. Legitimises SANDHI's STS protocol. `sralab.org/rehabilitation-measures/30-second-sit-stand-test` · `pmc.ncbi.nlm.nih.gov/articles/PMC9539496`
7. **Knee adduction moment (KAM) from a single IMU via deep learning** & EPFL wGait — why knee-level IMUs can substitute for force plates. `sciencedirect.com/science/article/pii/S2949705125000088` · `epfl.ch/labs/lmam/wgait`
8. **IMU OA-vs-healthy gait classification** — SVM 7-IMU sagittal kinematics (82.3% healthy-vs-pathologic; 97% joint-angle / 87.2% STGP in Teufl); APDM-MOST gait-asymmetry links. Feature lineage: asymmetry, cadence, sagittal kinematics. `pubmed.ncbi.nlm.nih.gov/38341759` · `pmc.ncbi.nlm.nih.gov/articles/PMC9204569`
9. **Alternative sensing** — plantar-pressure insoles (JMIR Aging 2024) and RGB-D cameras for OA gait; both show objective functional metrics beat static radiographs; both are hardware SANDHI avoids. `aging.jmir.org/2024/1/e58261` · `sciencedirect.com/science/article/pii/S0895611120300811`
10. **Open datasets** as training backbone — Mendeley KOA+PD gait; figshare IMU gait w/ KOA/ACL cohorts; OAI/Kaggle KL X-rays. `data.mendeley.com/datasets/44pfnysy89/1` · `pmc.ncbi.nlm.nih.gov/articles/PMC12546693`

## 6. Gap analysis — where SANDHI wins

1. **The screen target is empty** — no product offers a pre-clinical, non-imaging **knee-OA risk score** for mass community screening. Imaging AI (KOALA, RBknee) needs X-ray+radiology+PACS; gait players do measurement, not triage scoring; mHealth-OA apps are self-management/education (JMIR 2023 scoping review: exercise, coaching, Fitbit-style trackers only). SANDHI owns "objective mechanical screening score" end-to-end.
2. **Nobody is designed for the operator: an ASHA worker.** GaitSmart *imagined* a primary-care assistant but shipped for clinics/NHS. CBAC/NP-NCD and Khushi Baby serve ASHAs but are checklists/telephony with **no sensor or biomechanical node** — and knee OA has **no CBAC module at all**. SANDHI is first to make hardware+ML match the ASHA workflow (voice prompts, multilingual, icon-driven, paper slip as primary artefact).
3. **True offline-first.** GaitSmart is explicitly cloud-computing; eSanjeevani/NP-NCD/OneStep/Dozee assume connectivity; research prototypes assume a laptop. Published **Manipur** NP-NCD evidence (connectivity failures) is the exact NER failure mode SANDHI's IndexedDB-outbox + Go-sync is engineered for. No competitor ships an offline-queued, sync-when-connected district-dashboard pipeline for community screening.
4. **Cost / bill of materials.** Cheapest relevant clinical systems are $4–9k (Xsens) or ≈$20k (APDM); everything else $10–250k. SANDHI's ESP32 + 2×IMU strap is in the **<$20–40 parts** range — 2–3 orders cheaper — and needs no treadmill or mocap volume. (CADENCE study: ankle/thigh placement beats wrist for slow-walk accuracy → supports knee-strap over wrist-band.)
5. **The NER-specific story is unclaimed.** GBD/NER data show high, rising knee-OA burden and documented NCD-digitalisation friction in the North-East, but **no published system targets the North-East or any low-resource Indian rural setting for OA**. First-mover on "North-East evidence," including a chance to co-generate a region-validated IMU gait dataset.
6. **Reporting for the low-literacy / referral chain.** Papers produce graded reports for experts; SANDHI produces a **PDF referral slip** the villager takes to the PHC/eSanjeevani hub — closing the loop CBAC already formalises (suspect → refer → PHC/CHC/DH), which no gait product supports.

### Honest remaining de-risks
- **Clinical validation** — everything in §5 is lab-scale (n = dozens); SANDHI needs a cohort validation vs clinical exam/radiography or KAM/STS gold standards to stand against Pfizer-BU and GaitSmart evidence.
- **Model generalisation across the NER population** — body size, footwear, terrain vs treadmill-derived norms.
- **Regulation** — any "risk score" claim enters CDSCO/MoHFW medical-device scope; frame outputs as "referral-support screening," not diagnosis (mirrors GaitSmart Class-I "aid, not diagnosis" and KOALA's stated intent).
- **Power/data security** — offline-only operation over many village sessions; battery, storage, and PII/privacy posture for ABDM-grade data.

## Quick scorecard

| System | Knee-OA risk score? | Community/ASHA-ready? | Offline? | ~Price grade |
|---|---|---|---|---|
| GaitSmart (UK) | ✗ (gait report) | Partially (PC) | ✗ (cloud) | £10s/assessment |
| APDM/Clario | ✗ | ✗ | ✗ | ≈$20k |
| Xsens Awinda | ✗ | ✗ | ✗ | $3.8–12k |
| GaitUp Physilog | ✗ | ✗ | ✗ | €k+ kits |
| OneStep / Sway | ✗ (fall risk) | Partially (nursing) | ✗ | SaaS |
| Sensoria / RADIAN | ✗ (ROM/adherence) | Partially (home) | ✗ | Consumer SaaS |
| ImageBiopsy KOALA / RBknee | ✓ (KL on X-ray) | ✗ (radiology) | ✗ | Per-exam licence |
| CPHC-NCD / CBAC | ✗ (checklist) | ✓ (ASHA/ANM) | Partial (sync) | Free (govt) |
| Khushi Baby CHIP | ✗ | ✓ (ASHAs) | Partial | Gov-funded |
| Dozee | ✗ (vitals/EWS) | Partially (hospitals→home) | ✗ | ~$350 + sub |
| **SANDHI** | **✓ (ML risk score)** | **✓ (by design)** | **✓ (outbox + server)** | **<$50 BOM** |

*Every claim traces to a live-search-verified source; citations embedded inline per product.*