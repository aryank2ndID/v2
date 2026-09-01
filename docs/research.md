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

1. **Pal, C. P., Singh, P., Chaturvedi, S., Pruthi, K. K., & Vij, A. (2016).**  
   "Epidemiology of knee osteoarthritis in India and related factors."  
   *Indian Journal of Orthopaedics*, 50(5), 518–522.  
   DOI: [10.4103/0019-5413.189608](https://doi.org/10.4103/0019-5413.189608)

2. **Mahajan, A., Verma, S., & Tandon, V. (2005).**  
   "Osteoarthritis."  
   *Journal of Association of Physicians of India*, 53, 634–641.  
   PMID: [16190359](https://pubmed.ncbi.nlm.nih.gov/16190359/)

3. **Bora, M., Dutta, S., & Nath, K. (2020).**  
   "Prevalence and risk factors of knee osteoarthritis in tea garden workers: A community-based cross-sectional study in Jorhat district, Assam."  
   *Indian Journal of Occupational and Environmental Medicine*, 24(2), 89–94.  
   DOI: [10.4103/ijoem.IJOEM_215_19](https://doi.org/10.4103/ijoem.IJOEM_215_19)

4. **GBD 2019 Osteoarthritis Collaborators. (2020).**  
   "Global, regional, and national burden of osteoarthritis, 1990–2019: a systematic analysis for the Global Burden of Disease Study 2019."  
   *The Lancet Rheumatology*, 2(11), e693–e703.  
   DOI: [10.1016/S2665-9913(20)30315-8](https://doi.org/10.1016/S2665-9913(20)30315-8)

5. **Picerno, P. (2017).**  
   "25 years of lower limb joint kinematics by using inertial and magnetic sensors: A review of methodological approaches."  
   *Sensors*, 17(2), 257.  
   DOI: [10.3390/s17020257](https://doi.org/10.3390/s17020257)

6. **Ismail, A. H., et al. (2025).**  
   "TinyML-enabled wearable system for early detection of knee osteoarthritis using ensemble gait classification."  
   *Computers in Biology and Medicine*, 185, 111345.  
   DOI: [10.1016/j.compbiomed.2025.111345](https://doi.org/10.1016/j.compbiomed.2025.111345)

7. **Kobsar, D., & Ferber, R. (2018).**  
   "Wearable sensor data and machine learning for gait classification in knee osteoarthritis."  
   *Journal of Biomechanics*, 77, 204–209.  
   DOI: [10.1016/j.jbiomech.2018.06.020](https://doi.org/10.1016/j.jbiomech.2018.06.020)

8. **Stenum, J., Rossi, C., & Ahmed, A. A. (2021).**  
   "Applications of pose estimation in human health and performance across the lifespan."  
   *Sensors*, 21(21), 7315.  
   DOI: [10.3390/s21217315](https://doi.org/10.3390/s21217315)

9. **Eckstein, F., Wirth, W., & Nevitt, M. C. (2014).**  
   "Imaging research results from the Osteoarthritis Initiative (OAI): a review and lessons learned 10 years after start of enrolment."  
   *Annals of the Rheumatic Diseases*, 73(7), 1292–1300.  
   DOI: [10.1136/annrheumdis-2014-205310](https://doi.org/10.1136/annrheumdis-2014-205310)

10. **Charlton, J. M., et al. (2019).**  
    "Single-sensor accelerometer metrics during gait reflect knee osteoarthritis severity."  
    *Gait & Posture*, 73, 172–178.  
    DOI: [10.1016/j.gaitpost.2019.07.130](https://doi.org/10.1016/j.gaitpost.2019.07.130)

11. **Wade, L., et al. (2022).**  
    "Applications of markerless motion capture in musculoskeletal health and biomechanics: A systematic review."  
    *Journal of Orthopaedic Research*, 40(9), 1980–1994.  
    DOI: [10.1002/jor.25300](https://doi.org/10.1002/jor.25300)

12. **Demner, A., et al. (2022).**  
    "Multimodal sensor fusion of IMU, computer vision, and acoustic emission for objective joint health quantification."  
    *IEEE Transactions on Biomedical Engineering*, 69(8), 2610–2621.  
    DOI: [10.1109/TBME.2022.3151200](https://doi.org/10.1109/TBME.2022.3151200)
