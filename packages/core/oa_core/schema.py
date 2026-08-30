"""Canonical data contracts for the OA screening pipeline.

Every layer (Expo app, CV pipeline, IMU firmware bridge, sync API, ML model)
speaks these structures.  Change them here and nowhere else.

Units are explicit in field names: _deg, _s, _pct, _spm, _norm (dimensionless).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, computed_field

SCHEMA_VERSION = "0.1.0"


class Sex(str, Enum):
    female = "female"
    male = "male"
    other = "other"


class RiskBand(str, Enum):
    low = "LOW"
    moderate = "MODERATE"
    high = "HIGH"


class Side(str, Enum):
    left = "L"
    right = "R"


# --------------------------------------------------------------------------- #
# 1. Patient-reported inputs (PS requirement #3: pain & mobility)
# --------------------------------------------------------------------------- #
class Questionnaire(BaseModel):
    """WOMAC-style ordinal items (0 = none .. 4 = extreme) plus risk covariates.

    NOT the licensed WOMAC/KOOS instrument - these are equivalent-construct
    items we author ourselves so the prototype carries no licensing question.
    """

    # pain subscale
    pain_walking: int = Field(0, ge=0, le=4)
    pain_stairs: int = Field(0, ge=0, le=4)
    pain_at_night: int = Field(0, ge=0, le=4)
    pain_sitting: int = Field(0, ge=0, le=4)
    pain_standing: int = Field(0, ge=0, le=4)
    # stiffness subscale
    stiffness_morning: int = Field(0, ge=0, le=4)
    stiffness_later_day: int = Field(0, ge=0, le=4)
    stiffness_duration_min: int = Field(0, ge=0, le=240)
    # function subscale
    difficulty_stairs_down: int = Field(0, ge=0, le=4)
    difficulty_rising_from_sitting: int = Field(0, ge=0, le=4)
    difficulty_standing: int = Field(0, ge=0, le=4)
    difficulty_squatting: int = Field(0, ge=0, le=4)
    difficulty_walking_flat: int = Field(0, ge=0, le=4)
    # covariates
    prior_knee_injury: bool = False
    prior_knee_surgery: bool = False
    family_history_oa: bool = False
    crepitus: bool = False
    swelling_past_month: bool = False
    # NER-specific exposure: hill terrain farming / head-load carrying / squatting work
    occupational_load: Literal[0, 1, 2, 3] = 0
    daily_stair_or_slope_climbs: int = Field(0, ge=0, le=200)
    activity_min_per_week: int = Field(0, ge=0, le=1500)
    pain_years: float = Field(0.0, ge=0, le=60)
    worst_side: Optional[Side] = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def womac_pain_100(self) -> float:
        items = [self.pain_walking, self.pain_stairs, self.pain_at_night,
                 self.pain_sitting, self.pain_standing]
        return round(100.0 * sum(items) / (4 * len(items)), 1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def womac_stiffness_100(self) -> float:
        items = [self.stiffness_morning, self.stiffness_later_day]
        return round(100.0 * sum(items) / (4 * len(items)), 1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def womac_function_100(self) -> float:
        items = [self.difficulty_stairs_down, self.difficulty_rising_from_sitting,
                 self.difficulty_standing, self.difficulty_squatting,
                 self.difficulty_walking_flat]
        return round(100.0 * sum(items) / (4 * len(items)), 1)


# --------------------------------------------------------------------------- #
# 2. Objective measures (PS requirements #1 joint movement, #2 gait/posture)
# --------------------------------------------------------------------------- #
class GaitFeatures(BaseModel):
    """Derived from a 6-10 m walk, either camera pose-tracking or shank IMUs."""

    source: Literal["cv", "imu", "fusion", "synthetic"] = "synthetic"
    quality: float = Field(1.0, ge=0, le=1, description="0=discard, 1=clean capture")

    cadence_spm: float = Field(0, ge=0, le=200)
    gait_speed_norm: float = Field(0, ge=0, le=3,
                                  description="leg-lengths/s; scale-free stand-in for m/s")
    stride_time_s: float = Field(0, ge=0, le=4)
    stride_time_cv_pct: float = Field(0, ge=0, le=60, description="stride-to-stride variability")
    double_support_pct: float = Field(0, ge=0, le=60)

    stance_pct_l: float = Field(0, ge=0, le=100)
    stance_pct_r: float = Field(0, ge=0, le=100)
    step_length_norm_l: float = Field(0, ge=0, le=2)
    step_length_norm_r: float = Field(0, ge=0, le=2)
    knee_flex_peak_stance_l: float = Field(0, ge=-10, le=90)
    knee_flex_peak_stance_r: float = Field(0, ge=-10, le=90)
    knee_rom_gait_l: float = Field(0, ge=0, le=90)
    knee_rom_gait_r: float = Field(0, ge=0, le=90)
    toe_out_deg_l: float = Field(0, ge=-30, le=60)
    toe_out_deg_r: float = Field(0, ge=-30, le=60)

    @staticmethod
    def _si(a: float, b: float) -> float:
        """Robinson symmetry index, %. 0 = perfectly symmetric."""
        m = (a + b) / 2.0
        return 0.0 if m == 0 else round(abs(a - b) / m * 100.0, 2)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def stance_asym_pct(self) -> float:
        return self._si(self.stance_pct_l, self.stance_pct_r)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def step_length_asym_pct(self) -> float:
        return self._si(self.step_length_norm_l, self.step_length_norm_r)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def knee_rom_asym_pct(self) -> float:
        return self._si(self.knee_rom_gait_l, self.knee_rom_gait_r)


class JointFeatures(BaseModel):
    """Guided active range-of-motion + functional performance tests."""

    source: Literal["cv", "imu", "fusion", "manual", "synthetic"] = "synthetic"
    knee_flex_max_l: float = Field(0, ge=0, le=160)
    knee_flex_max_r: float = Field(0, ge=0, le=160)
    knee_ext_deficit_l: float = Field(0, ge=-10, le=45, description="lag from full extension")
    knee_ext_deficit_r: float = Field(0, ge=-10, le=45)
    sts5_time_s: float = Field(0, ge=0, le=90, description="five-times sit-to-stand")
    tug_time_s: float = Field(0, ge=0, le=90, description="timed up-and-go")
    varus_valgus_deg_l: float = Field(0, ge=-30, le=30, description="- varus / + valgus")
    varus_valgus_deg_r: float = Field(0, ge=-30, le=30)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def knee_rom_l(self) -> float:
        return round(max(0.0, self.knee_flex_max_l - self.knee_ext_deficit_l), 1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def knee_rom_r(self) -> float:
        return round(max(0.0, self.knee_flex_max_r - self.knee_ext_deficit_r), 1)


class PostureFeatures(BaseModel):
    source: Literal["cv", "manual", "synthetic"] = "synthetic"
    trunk_lean_deg: float = Field(0, ge=-30, le=45)
    pelvic_obliquity_deg: float = Field(0, ge=-20, le=20)
    shoulder_tilt_deg: float = Field(0, ge=-20, le=20)
    stance_width_norm: float = Field(0, ge=0, le=2)
    sway_area_norm: float = Field(0, ge=0, le=5, description="30 s quiet-stance CoM proxy")


# --------------------------------------------------------------------------- #
# 3. Encounter + result
# --------------------------------------------------------------------------- #
class Patient(BaseModel):
    """Pseudonymous by design: no name/phone/address ever leaves the device."""

    patient_id: str = Field(..., pattern=r"^NER-[0-9A-Z]{4,10}$")
    age: int = Field(..., ge=10, le=110)
    sex: Sex
    height_cm: float = Field(..., ge=100, le=220)
    weight_kg: float = Field(..., ge=25, le=200)
    district_code: Optional[str] = Field(None, max_length=12, description="district, not village")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def bmi(self) -> float:
        return round(self.weight_kg / (self.height_cm / 100.0) ** 2, 1)


class Assessment(BaseModel):
    schema_version: str = SCHEMA_VERSION
    assessment_id: str
    patient: Patient
    questionnaire: Questionnaire
    gait: GaitFeatures = GaitFeatures()
    joint: JointFeatures = JointFeatures()
    posture: PostureFeatures = PostureFeatures()
    captured_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_id: str = "dev-unknown"
    worker_id: str = "chw-unknown"
    locale: str = "en"
    synced: bool = False


class Indicator(BaseModel):
    code: str
    label: str
    value: str
    domain: Literal["symptom", "gait", "joint", "posture", "covariate"]
    weight: float


class RiskResult(BaseModel):
    band: RiskBand
    score_0_100: float
    rule_score_0_100: float
    ml_probability: Optional[float] = None
    domain_scores: dict[str, float] = {}
    indicators: list[Indicator] = []
    recommendations: list[str] = []
    guidance_keys: list[str] = []
    needs_referral: bool
    disagreement: bool = False
    model_escalated: bool = False
    capture_quality: float = 1.0
    model_version: str = "rules-0.1.0"
    disclaimer_key: str = "disclaimer.not_a_diagnosis"
