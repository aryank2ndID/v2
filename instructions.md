# SIH26004 Implementation Plan & Instructions

This document outlines the current state of the Smart India Hackathon 2026 Problem Statement SIH26004 prototype, highlighting what has been completed and what remains to be implemented across the 5 layers defined in the system architecture.

## 1. What is Done ✅

* **Architecture & Documentation:**
  * Comprehensive system architecture and data flow defined (`SIH26004-architecture.md`).
  * System overview and setup instructions (`README.md`).

* **Machine Learning & Core Logic (`packages/core`):**
  * Core schemas and data models (`schema.py`).
  * Feature extraction and clinical rules evaluation (`features.py`, `rules.py`).
  * Fused risk assessment logic (`risk.py`).
  * Model inference interface (`model.py`).
  * Multilingual support and localization engine (`i18n.py`, `locales/`).

* **Computer Vision Engine (`packages/cv`):**
  * Pose estimation backend integration (`pose.py`).
  * Gait cycle analysis (`gait.py`).
  * Posture evaluation (`posture.py`).
  * Range of Motion (ROM) angle calculations (`rom.py`).
  * Synthetic data generation modules (`synth.py`).

* **Data Pipelines & Scripts (`scripts/`):**
  * Tools to generate synthetic patient cohorts and kinematics (`make_cohort.py`).
  * Script to train the baseline offline risk model (`train_risk_model.py`).
  * End-to-end demo pipeline simulation (`demo_end_to_end.py`).

* **Dashboard / Web Frontend (`web/`):**
  * Next.js web application (`sandhi-web`) with UI for dashboard, screening, registry, model analysis, and kit integration.

---

## 2. What is Partially Done / Left 🚧

### A. Hardware & Firmware (`packages/firmware`)
* **Current State:** BLE server streams the two IMUs and the piezo mic over the frozen wire protocol (`sandhi_proto.h/.cpp` + `main.cpp`). Frame layout, CRC-16/CCITT-FALSE and packet sizes are verified byte-for-byte against the app decoder (`tools/protocol_test.mjs`). Builds clean on `platformio run` (ESP32 Arduino, Adafruit MPU6050) — 88.9% flash, 12.2% RAM, zero warnings.
* **Left:** Flashing/bench testing on physical hardware (imu calibration from rest, ADC pin mapping for a given rig).

### B. Mobile App (`packages/app`)
* **Current State:** Full React Native / Expo app built: ASHA intake form (en/as/hi), BLE client via `@sfourdrinier/react-native-ble-plx` (dev build only), on-device model inference (pure-TS tree runtime port of the trained model, bit-faithful to training per `tools/parity_check.mjs`), offline SQLite outbox (`db.ts`), Risk Band (Low/Watch/Refer) + localized advice, and a demo-simulator mode that runs the production pipeline end to end without hardware.
* **Left:** On-device trials (Expo dev build); any UX tuning from field use.

### C. Backend API & Sync (`server/`)
* **Current State:** Go single-binary backend (per the architecture doc) implements the sync/ingest endpoints: `POST /v1/screenings` (single or batch, idempotent on `client_id`), `GET /v1/screenings`, `GET /v1/stats`, `POST /v1/screenings/{id}/referral`, `GET /healthz`; append-only JSON store. The app outbox and the dashboard both sync against it.
* **Left:** PostgreSQL/MinIO for production scale; persisted idempotency across restarts.

### D. Dashboard Layer (`web/`)
* **Current State:** Next.js frontend wired to the Go backend: healthz ping, an outbox that POSTs screenings with the exact server contract, band/district/hotspot/terrain/registry pages.
* **Left:** The registry the pages render is the synthetic cohort (explicitly labelled). Pointing the pages at the server's `GET /v1/screenings`/`GET /v1/stats` is a documented hook for real field data.

### E. Model Export
* **Current State:** The training export (`ml/out/*.json` + pure-TS runtime consumed by the app) is a mobile-friendly format — no TFLite needed.
* **Left:** Retrain on a real cohort and re-bundle the JSON.

---

## 3. Step-by-Step Instructions for Next Steps 🛠️

To continue development systematically, follow this build order (prioritizing the riskiest components). Status as of the last pass: **Steps 1–5 are implemented** — keep this order for verification. All cross-layer checks are driven from `tools/protocol_test.mjs` (wire format, both engines) and `tools/parity_check.mjs` (on-device inference vs training); run both from the repo root.

### Step 1: Firmware BLE Integration
1. Navigate to `packages/firmware/esp32_imu`.
2. Update `main.cpp` to include BLE libraries (e.g., `<BLEDevice.h>`, `<BLEServer.h>`).
3. Set up a BLE service and characteristic to notify the connected client with IMU data packets at a high frequency.

### Step 2: Mobile App Foundation & BLE
1. Decide whether to stick with React Native (current code) or switch to Flutter (architecture doc).
2. Install BLE libraries (e.g., `react-native-ble-plx` for RN).
3. Build a simple UI to scan for the ESP32, connect, and log incoming sensor data.

### Step 3: Model Export & On-Device Integration
1. Run `python scripts/train_risk_model.py` to get a trained model.
2. Convert the resulting model to TFLite or ONNX.
3. Integrate the model into the mobile app to accept intake form data + sensor features and output a risk score entirely offline.

### Step 4: Outbox Sync & Backend
1. Build the local SQLite queue in the mobile app.
2. Flesh out `packages/api/oa_api/main.py` with SQLAlchemy/Postgres to receive batched syncs from the app.
3. Test offline-to-online transitions (turning off/on wifi on the mobile device).

### Step 5: Web Dashboard Setup & Integration
1. Navigate to the `web/` directory.
2. Install dependencies (e.g., `npm install`) and run the dev server (`npm run dev`).
3. Configure the Next.js app to make API calls to your FastAPI backend (`packages/api`) to display live registry and screening data.
