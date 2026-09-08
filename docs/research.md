# Osteoarthritis (OA) Early Detection: Research & References

This document outlines the clinical and technological research underpinning the SIH26004 project, focusing on the epidemiology of Osteoarthritis in India (specifically the North Eastern Region) and the state-of-the-art in multimodal diagnostic technologies (IMUs, Computer Vision, and Edge ML).

## 1. Clinical Context & Prevalence in NER

Osteoarthritis (OA) is the second most common rheumatological condition in India, contributing significantly to chronic pain, mobility loss, and disability among working and aging populations [1, 2].

### Key Epidemiological Statistics
* **National Prevalence**: The overall prevalence of knee OA in rural and urban Indian communities ranges between **22% and 39%** [1, 2].
* **North Eastern Region (NER) Specific Data**: Community-based cross-sectional epidemiological studies in Assam (specifically among tea garden communities in Jorhat district) demonstrate a **29.4% prevalence of knee osteoarthritis** [3].
* **Occupational Stressors in NER**: The terrain and labor demands of tea plucking, terrace farming, and wood transport in hilly NER districts require frequent static squatting, heavy load carrying, and steep decline walking. These ergonomic hazards significantly accelerate cartilage degradation and early-onset mechanical joint degeneration [3, 4].
* **Demographic Burden**: Prevalence increases sharply with age (≥50 years), female gender, and elevated Body Mass Index (BMI). Early detection at KL Grade 0–1 is critical before structural cartilage loss occurs [1, 4].

## 2. Technological Foundation & Multimodal AI

Our solution replaces capital-intensive diagnostic infrastructure (such as MRI machines or gait laboratory optoelectronic motion capture) with a lightweight, offline-first multimodal approach combining **Wearable Inertial Measurement Units (IMUs)**, **Smartphone Computer Vision (CV)**, and **Tabular Edge AI**.

### A. Wearable Kinematics (IMU Sensors)
* **Kinematic Validity**: Lower-limb wearable IMUs (accelerometers and gyroscopes mounted on thigh and shank) accurately capture spatiotemporal gait metrics—such as stance/swing ratios, heel-strike impact transients ($g$), and angular peak swing velocities [5, 10].
* **Machine Learning Accuracy**: ML models (Random Forests, LightGBM, and XGBoost) trained on IMU kinematic features discriminate osteoarthritic gait from asymptomatic controls with **93%–97% sensitivity and specificity** [6, 7].
* **Sit-to-Stand (STS) & Functional Assessment**: STS transfer duration, trunk lean angular velocity, and Log Non-Dimensional Jerk (LDLJ) smoothness metrics provide sensitive digital markers of knee extensor weakness and functional impairment [6, 12].

### B. Computer Vision & Markerless Motion Capture
* **Camera-Based Kinematics**: Mobile-based 2D markerless pose estimation frameworks (such as MoveNet and OpenPose) extract keypoint joint angles and Range of Motion (ROM) flexion/extension profiles directly from smartphone video streams [8, 11].
* **Clinical Viability**: Markerless motion capture achieves strong correlation ($r > 0.90$) with gold-standard 3D optical motion capture systems for sagittal-plane joint kinematics during walking and squatting tasks [8, 11].

### C. Multimodal Sensor Fusion & Datasets
* **Complementary Modalities**: Fusing high-frequency IMU joint dynamics with camera pose tracking and clinical risk factors mitigates individual sensor shortcomings—IMU drift is bound by visual keypoints, while visual occlusions in field camps are buffered by continuous IMU data streams [12].
* **Standard Dataset Benchmarking**: Foundational model training and feature normalization leverage large-scale clinical cohorts from the NIH Osteoarthritis Initiative (OAI), comprising longitudinal clinical, radiographic, and biomechanical records [9].

---
## 3. Peer-Reviewed References


4. GBD 2019 Osteoarthritis Collaborators. Global, regional, and national burden of osteoarthritis, 1990–2019: a systematic analysis for the Global Burden of Disease Study 2019. Lancet Rheumatol. 2020;2(9):e627–e638. doi:10.1016/S2665-9913(20)30227-9.
   **Link:** [https://doi.org/10.1016/S2665-9913(20)30227-9](https://doi.org/10.1016/S2665-9913%2820%2930227-9?utm_source=chatgpt.com) /

5. Picerno P. 25 years of lower limb joint kinematics by using inertial and magnetic sensors: A review of methodological approaches. Gait Posture. 2017;51:239–246. doi:10.1016/j.gaitpost.2016.11.008.
   **Link:** [https://doi.org/10.1016/j.gaitpost.2016.11.008](https://doi.org/10.1016/j.gaitpost.2016.11.008?utm_source=chatgpt.com) ()

6. Bharanidivya M, Dhanalakshmi S. TinyML-enabled wearable system for early detection of knee osteoarthritis using ensemble gait classification. Comput Biol Med. 2026;200:111345. doi:10.1016/j.compbiomed.2025.111345.
   **Link:** [https://doi.org/10.1016/j.compbiomed.2025.111345](https://doi.org/10.1016/j.compbiomed.2025.111345?utm_source=chatgpt.com)

7. Kobsar D, Ferber R. Wearable Sensor Data to Track Subject-Specific Movement Patterns Related to Clinical Outcomes Using a Machine Learning Approach. Sensors. 2018;18(9):2828. doi:10.3390/s18092828.
   **Link:** [https://doi.org/10.3390/s18092828](https://doi.org/10.3390/s18092828?utm_source=chatgpt.com)

8. Stenum J, Cherry-Allen KM, Pyles CO, Reetzke RD, Vignos MF, Roemmich RT. Applications of Pose Estimation in Human Health and Performance across the Lifespan. Sensors. 2021;21(21):7315. doi:10.3390/s21217315.
   **Link:** [https://doi.org/10.3390/s21217315](https://doi.org/10.3390/s21217315?utm_source=chatgpt.com)

9. Eckstein F, Kwoh CK, Link TM; OAI investigators. Imaging research results from the Osteoarthritis Initiative (OAI): a review and lessons learned 10 years after start of enrolment. Ann Rheum Dis. 2014;73(7):1289–1300. doi:10.1136/annrheumdis-2014-205310.
   **Link:** [https://doi.org/10.1136/annrheumdis-2014-205310](https://doi.org/10.1136/annrheumdis-2014-205310?utm_source=chatgpt.com)
   

