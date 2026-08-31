# SIH26004 — AI-Assisted Early Detection of Osteoarthritis Risk Markers (NER)

> **Ministry:** MDoNER · **Track:** Hardware · **Theme:** Space Technology (as listed)
> **One-line pitch:** A field kit + offline AI that lets an ASHA worker screen a village for early knee OA in 3 minutes — no doctor, no X-ray, no internet.

---

## 1. The Product in One Picture

```mermaid
flowchart LR
    A["🚶 Patient<br/>30s walk + 5 sit-stands"] --> B["📟 Wearable Kit<br/>ESP32 + IMUs"]
    B -->|BLE| C["📱 ASHA Phone App<br/>offline-first"]
    C --> D["🧠 On-device Model<br/>TFLite risk score"]
    D --> E["🟢🟡🔴 Risk Band<br/>+ referral advice"]
    C -.->|when network returns| F["☁️ Backend<br/>registry + dashboard"]

    classDef patient fill:#FDF0F5,stroke:#E8A0BF,stroke-width:2px,color:#5A3E4D
    classDef device fill:#E8F4F8,stroke:#7FB3C8,stroke-width:2px,color:#2E4A57
    classDef app fill:#F0F7E8,stroke:#A3C585,stroke-width:2px,color:#3E4F2E
    classDef brain fill:#FFF4E6,stroke:#E8B872,stroke-width:2px,color:#5A4527
    classDef cloud fill:#F3EFFA,stroke:#A99BD1,stroke-width:2px,color:#3F3557

    class A patient
    class B device
    class C app
    class D,E brain
    class F cloud
```

**Why this shape wins:** it is a *hardware* problem statement. A pure web dashboard loses. The judges want to see a physical thing that works in a village with no signal.

---

## 2. System Architecture — 5 Layers

```mermaid
flowchart TB
    subgraph L1["① EDGE DEVICE"]
        direction LR
        S1["IMU — thigh<br/>MPU6050 / BNO055"]
        S2["IMU — shin"]
        MCU["ESP32<br/>sampling + BLE"]
        S1 --> MCU
        S2 --> MCU
    end

    subgraph L2["② MOBILE APP — Flutter"]
        direction LR
        CAP["BLE capture<br/>+ session timer"]
        FORM["Intake form<br/>age · BMI · occupation<br/>squat-load · WOMAC pain"]
        INF["TFLite inference<br/>runs OFFLINE"]
        QUE["Outbox queue<br/>SQLite"]
        CAP --> INF
        FORM --> INF
        INF --> QUE
    end

    subgraph L3["③ BACKEND — Python / FastAPI"]
        direction LR
        API["Sync / Ingest API"]
        REG["Patient registry"]
        REF["Referral workflow"]
        PG[("PostgreSQL")]
        OBJ[("MinIO / S3<br/>raw signal blobs")]
        API --> REG --> PG
        API --> REF --> PG
        API --> OBJ
    end

    subgraph L4["④ ML SERVICE — Python / FastAPI"]
        direction LR
        FE["Feature extraction<br/>gait"]
        TAB["XGBoost<br/>tabular risk"]
        CNN["CNN — KL grade<br/>optional, X-ray at PHC"]
        EXP["Export → TFLite"]
        FE --> TAB --> EXP
        CNN --> EXP
    end

    subgraph L5["⑤ DASHBOARD — Next.js"]
        direction LR
        MAP["District hotspot map"]
        CNT["Screening counts"]
        FUP["Follow-up tracking"]
    end

    L1 -->|BLE| L2
    L2 -->|"HTTPS, batched, when online"| L3
    L3 <-->|"training data / model artifacts"| L4
    L4 -.->|"model bundle pushed to app"| L2
    L3 --> L5

    classDef edge fill:#E8F4F8,stroke:#7FB3C8,stroke-width:2px,color:#2E4A57
    classDef mob fill:#F0F7E8,stroke:#A3C585,stroke-width:2px,color:#3E4F2E
    classDef back fill:#FFF4E6,stroke:#E8B872,stroke-width:2px,color:#5A4527
    classDef ml fill:#F3EFFA,stroke:#A99BD1,stroke-width:2px,color:#3F3557
    classDef dash fill:#FDF0F5,stroke:#E8A0BF,stroke-width:2px,color:#5A3E4D

    class S1,S2,MCU edge
    class CAP,FORM,INF,QUE mob
    class API,REG,REF,PG,OBJ back
    class FE,TAB,CNN,EXP ml
    class MAP,CNT,FUP dash

    style L1 fill:#F7FBFD,stroke:#B9D9E6,stroke-width:2px,color:#2E4A57
    style L2 fill:#F9FCF5,stroke:#CADFB6,stroke-width:2px,color:#3E4F2E
    style L3 fill:#FFFBF4,stroke:#F0D9AE,stroke-width:2px,color:#5A4527
    style L4 fill:#FAF8FD,stroke:#CFC6E6,stroke-width:2px,color:#3F3557
    style L5 fill:#FEF8FB,stroke:#F0CADB,stroke-width:2px,color:#5A3E4D
```

---

## 3. Screening Flow (what actually happens in the village)

```mermaid
sequenceDiagram
    autonumber
    participant P as 🚶 Patient
    participant A as 👩‍⚕️ ASHA Worker
    participant K as 📟 Kit
    participant M as 📱 App
    participant B as ☁️ Backend

    A->>M: Open app, new screening
    A->>M: Fill intake (age, BMI, work type, pain)
    A->>P: Strap kit above + below knee
    A->>K: Start session
    P->>K: 30s walk + 5 sit-to-stands
    K-->>M: Stream IMU over BLE
    M->>M: Extract features → TFLite → risk score
    M-->>A: 🟢 Low / 🟡 Watch / 🔴 Refer to PHC
    A->>P: Explain result + exercise advice
    Note over M,B: Phone has no signal — result sits in outbox
    M->>B: Sync batch when back in network
    B-->>B: Update registry, flag referrals, redraw hotspot map
```

---

## 4. Stack — Final Call

| Layer | Choice | Why |
|---|---|---|
| **Firmware** | ESP32 + Arduino/ESP-IDF, BLE | Cheap, BLE built in, huge sensor library support |
| **Sensors** | 2× IMU (MPU6050 or BNO055) | Gait + knee angle |
| **App** | Flutter + SQLite + `flutter_blue_plus` + `tflite_flutter` | One codebase, real offline story, on-device inference |
| **Backend** | **Python** — FastAPI | Compatibility with ML models, quick iteration |
| **DB** | PostgreSQL + MinIO/S3 | Records in PG, raw signal blobs in object store |
| **ML** | Python, FastAPI, XGBoost (+ optional CNN), export TFLite | Tabular model does the heavy lifting; CNN is a bonus |
| **Dashboard** | Next.js + Tailwind + Recharts + MapLibre | Fast to build, looks good on stage |
| **Data** | OAI (Osteoarthritis Initiative) cohort, public KL-graded knee X-ray sets, your own pilot captures | Real citable data > invented numbers |

---

## 5. Build Order — riskiest thing first

```mermaid
flowchart LR
    W1["① Signal spec<br/>+ synthetic data gen"] --> W2["② Firmware<br/>capture + BLE"]
    W2 --> W3["③ Flutter app<br/>BLE + intake + outbox"]
    W3 --> W4["④ Risk model<br/>features → XGBoost → TFLite"]
    W4 --> W5["⑤ Python sync API<br/>+ Postgres"]
    W5 --> W6["⑥ Dashboard<br/>+ demo polish"]

    classDef hard fill:#FFF4E6,stroke:#E8B872,stroke-width:2px,color:#5A4527
    classDef mid fill:#F0F7E8,stroke:#A3C585,stroke-width:2px,color:#3E4F2E
    classDef easy fill:#E8F4F8,stroke:#7FB3C8,stroke-width:2px,color:#2E4A57

    class W1,W2,W4 hard
    class W3 mid
    class W5,W6 easy
```

**Rule:** the backend is the *least* risky part — build it last. Hardware + model is where teams die.
The synthetic data generator in step ① is what lets the app and model team start before the hardware works.

---

## 6. Things That Decide the Score

| ✅ Do | ❌ Don't |
|---|---|
| Say **"screening / triage, not diagnosis"** everywhere | Claim you diagnose osteoarthritis |
| Show a clear architecture | Pending details |
| Demo with **airplane mode on** | Depend on venue wifi |
| Local-language UI (Assamese / Khasi / Mizo) | Generic English-only app |
| Cite OAI dataset + real NER prevalence numbers | Invent accuracy figures |
| Explain *why NER* — terrain, walking loads, PHC density | Build something that could be for any state |
| One working physical kit on the table | Slides of a kit |

---

## 7. Open Decisions

- **X-ray CNN — in or out?** Only include if you can show it running on a PHC's existing X-ray. Otherwise it's dead weight.
- **Who owns firmware?** This is the single-point-of-failure role. Assign it before anything else.

---

*Screening tool for community health workers. Not a diagnostic device. Any risk flag must route to a qualified clinician.*
