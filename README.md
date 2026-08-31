# Osteoarthritis Early Detection System for NER (SIH26004)

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![Hardware](https://img.shields.io/badge/category-hardware-blue.svg)

This repository contains the prototype solution for **Smart India Hackathon 2026 Problem Statement SIH26004**: *AI-Assisted Early Detection System for Osteoarthritis (OA) Risk Markers in North Eastern Region (NER)*. 

## 🎯 Problem Overview

The objective is to build a physical/portable assessment component with an AI-driven software backend to help healthcare workers in rural/remote healthcare camps in the North Eastern Region evaluate an individual's risk for Osteoarthritis (OA) without requiring reliable internet. 

The system provides early risk indications so that individuals can be referred for specialized orthopedic evaluation.

### Key Requirements Addressed:
- **Offline Operation**: Can work without reliable internet.
- **Sensor & Vision Based Assessment**: Integrates with physical hardware (IMU sensors) and computer vision (camera).
- **Multilingual Support**: Tailored for regional languages.
- **Healthcare Worker App**: Easy-to-use digital interface for initial screenings.
- **Report Generation**: Preliminary screening reports with clear risk evaluation.

## 📊 Research, Feasibility & Sources

### The Context of OA in NER
The North Eastern Region (NER) of India features hilly terrain and a high proportion of the population engaged in physically demanding agricultural occupations. Frequent squatting, stair climbing, and navigating uneven terrain contribute significantly to early-onset knee joint degeneration. According to recent epidemiological reviews, the pooled prevalence of OA in rural Indian communities ranges from 22% to 28%. In NER specifically, geographical and occupational factors exacerbate mechanical stress on weight-bearing joints.

### Technical Feasibility
1. **IMU-Based Kinematics**: Research demonstrates that Inertial Measurement Units (IMUs) attached to the lower limbs (shank and thigh) can accurately capture spatiotemporal gait parameters (e.g., stance time, swing peak velocity) and sit-to-stand kinematics. These kinematic markers exhibit strong correlation with the Kellgren-Lawrence (KL) grade of osteoarthritis.
2. **Offline AI (TinyML)**: Extracting these kinematic features and running inference on an XGBoost or LightGBM model requires minimal compute. This makes it highly feasible to execute the entire risk assessment locally on a low-end smartphone (Edge AI), addressing the connectivity constraints of remote NER healthcare camps.
3. **Cost-Effectiveness**: Standardizing on widely available sensors (like MPU6050/BNO055) and an ESP32 microcontroller ensures the hardware component remains affordable and scalable for mass deployment by ASHA workers.

### Key Sources
- **The Osteoarthritis Initiative (OAI)**: A multi-center, observational study of men and women providing a comprehensive clinical and radiographic dataset used as a foundational proxy for model training. (https://nda.nih.gov/oai/)
- *Pal et al., 2016*: "Prevalence of Osteoarthritis in India: An Epidemiological Review" - provides baseline prevalence statistics for rural Indian populations.
- *Various Kinematic Studies*: Research validating the use of wearable IMUs for distinguishing healthy gait from osteoarthritic gait through measures of joint angle range of motion and stride variability.

## 🏗️ System Architecture

Our solution adopts a modular monorepo architecture, splitting the responsibilities across different domains to ensure maintainability, clear separation of concerns, and easy deployment to embedded and mobile devices.

### 1. `packages/firmware` (Hardware Component)
* **Description**: ESP32-based IMU (Inertial Measurement Unit) firmware.
* **Role**: Captures high-frequency joint movement data (acceleration, gyroscope) directly from the patient's limbs during specific exercises.
* **Stack**: C++ / PlatformIO / ESP32.

### 2. `packages/cv` (Computer Vision Engine)
* **Description**: Offline-capable computer vision models (`oa_cv`).
* **Role**: Analyzes the patient's gait, posture, and Range of Motion (ROM) using a standard smartphone or tablet camera.
* **Key Features**:
  - `gait.py`: Gait cycle analysis (stride, symmetry, stance).
  - `pose.py`: Pose estimation backend integration.
  - `posture.py`: Spinal and joint alignment evaluation.
  - `rom.py`: Angle calculation for joint flexion/extension.

### 3. `packages/core` (AI & ML Core)
* **Description**: Core machine learning models and business rules (`oa_core`).
* **Role**: Fuses inputs from the clinical questionnaire, CV engine, and hardware sensors to produce a comprehensive risk score.
* **Key Features**:
  - `risk.py` / `model.py`: Fused risk assessment and model inference.
  - `rules.py` / `features.py`: Clinical rule evaluation and feature extraction.
  - `schema.py`: Shared data schemas for interoperability.
  - `i18n.py`: Localization engine (English, Hindi, Assamese).

### 4. `packages/api` (Backend & Sync)
* **Description**: Lightweight API server (`oa_api`).
* **Role**: Acts as a local processing node and sync server. It handles the offline-first data aggregation and syncs to a central cloud when connectivity is restored.
* **Stack**: Python / FastAPI (or similar).

### 5. `packages/app` (Healthcare Worker Interface)
* **Description**: Mobile application for the healthcare workers.
* **Role**: The primary UI for conducting the screening, viewing real-time sensor data, and generating the final referral report.
* **Stack**: React Native / Expo.

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- PlatformIO (for firmware)

### Installation
1. **Core & CV Modules**
   ```bash
   cd packages/core && pip install -e .
   cd ../cv && pip install -e .
   ```
2. **Mobile App**
   ```bash
   cd packages/app && npm install
   ```

### Scripts
The `scripts/` directory contains tools for generating synthetic clinical datasets and training the baseline risk models:
- `make_cohort.py`: Generates a synthetic dataset of patient profiles and simulated kinematics.
- `train_risk_model.py`: Trains the initial offline risk evaluation model.
- `demo_end_to_end.py`: Runs a full simulation of the data pipeline.
