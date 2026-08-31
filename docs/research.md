# Osteoarthritis (OA) Early Detection: Research & References

This document outlines the clinical and technological research underpinning the SIH26004 project, focusing on the prevalence of Osteoarthritis in India (specifically the North Eastern Region) and the state-of-the-art in multimodal diagnostic technologies.

## 1. Clinical Context & Prevalence in NER

Osteoarthritis is the second most common rheumatological problem in India, contributing significantly to disability among the aging population. 

### Key Statistics
*   **National Prevalence**: The overall prevalence of OA in India ranges between **22% and 39%** [1, 2]. 
*   **NER Specific Data**: While region-wide data for the North East is limited, a focused community-based study in the Jorhat district of Assam (among tea garden workers) reported a **29.4% prevalence of knee osteoarthritis** [3].
*   **Demographic Risk Factors**: The burden is significantly higher among females, individuals over 50 years of age, and those with high Body Mass Index (BMI). Physically demanding occupations—such as agricultural work prevalent in the NER—heavily exacerbate joint wear and tear [3, 4].

## 2. Technological Foundation

Our solution replaces traditional, expensive diagnostic methods (like X-Rays and Gait Labs) with a multimodal approach combining **Inertial Measurement Units (IMUs)** and **Computer Vision (CV)**.

### A. IMU Sensors (Wearable Kinematics)
*   **Validity**: Wearable IMU sensors (accelerometers and gyroscopes) are proven to accurately capture high-frequency joint movement and gait irregularities [5].
*   **Accuracy**: Machine learning models trained on IMU data have successfully differentiated between healthy individuals and those with early-stage OA, achieving classification accuracies of **93%–97%** in clinical studies [6].
*   **Real-World Application**: They are highly effective for monitoring functional activities (walking, sit-to-stand) outside of laboratory settings.

### B. Computer Vision (CV)
*   **Mechanism**: CV systems analyze human motion via standard 2D smartphone cameras, tracking skeletal keypoints to identify motor function disparities and Range of Motion (ROM) limitations [7].
*   **Benefits**: Provides a completely non-contact, accessible method to evaluate posture and joint alignment without specialized equipment.

### C. The Multimodal Advantage
*   Integrating both IMU (internal joint dynamics) and CV (external gross motor movement) along with clinical questionnaires addresses the limitations of each standalone system. For example, IMU sensor drift is compensated by absolute visual tracking, while visual occlusions are handled by continuous IMU data streams [8].

## 3. References

1. *Pal, C. P., et al. (2016). Epidemiology of knee osteoarthritis in India and related factors. Indian Journal of Orthopaedics.*
2. *Mahajan, A., et al. (2005). Osteoarthritis. Journal of Association of Physicians of India.*
3. *Community-based cross-sectional study of knee osteoarthritis in Jorhat, Assam (2019–2020).*
4. *Global Burden of Disease Study (2019) on Osteoarthritis.*
5. *Picerno, P. (2017). 25 years of lower limb joint kinematics by using inertial and magnetic sensors: A review of methodological approaches. Sensors.*
6. *Various NIH and MDPI published studies on IMU-based ML models for OA detection (2020-2023).*
7. *Stenum, J., et al. (2021). Applications of pose estimation in human health and performance across the lifespan. Sensors.*
8. *Multimodal sensor fusion research in biomechanics and early disease detection (2022).*
