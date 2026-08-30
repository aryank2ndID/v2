"""The contracts every layer speaks. If these drift, everything downstream lies."""
import pytest
from pydantic import ValidationError


def test_womac_subscales_are_percentages_of_the_max():
    from oa_core.schema import Questionnaire
    q = Questionnaire(pain_walking=3, pain_stairs=4)
    assert q.womac_pain_100 == 35.0          # 7 of 20 possible points
    assert Questionnaire().womac_pain_100 == 0.0
    full = Questionnaire(**{k: 4 for k in
                            ("pain_walking", "pain_stairs", "pain_at_night",
                             "pain_sitting", "pain_standing")})
    assert full.womac_pain_100 == 100.0


def test_symmetry_index_is_zero_for_identical_sides_and_scale_free():
    from oa_core.schema import GaitFeatures
    g = GaitFeatures(step_length_norm_l=0.7, step_length_norm_r=0.7)
    assert g.step_length_asym_pct == 0.0
    a = GaitFeatures(step_length_norm_l=0.6, step_length_norm_r=0.4)
    b = GaitFeatures(step_length_norm_l=1.2, step_length_norm_r=0.8)
    assert a.step_length_asym_pct == b.step_length_asym_pct == 40.0


def test_symmetry_index_of_all_zero_is_zero_not_a_division_error():
    from oa_core.schema import GaitFeatures
    assert GaitFeatures().stance_asym_pct == 0.0


def test_knee_rom_is_flexion_minus_extension_lag_and_never_negative():
    from oa_core.schema import JointFeatures
    j = JointFeatures(knee_flex_max_l=120, knee_ext_deficit_l=10)
    assert j.knee_rom_l == 110.0
    assert JointFeatures(knee_flex_max_r=5, knee_ext_deficit_r=20).knee_rom_r == 0.0


def test_patient_id_pattern_rejects_free_text_so_no_name_can_be_typed_into_it():
    from oa_core.schema import Patient
    ok = Patient(patient_id="NER-02491", age=56, sex="female", height_cm=152, weight_kg=64)
    assert ok.bmi == 27.7
    for bad in ("Reena Das", "02491", "ner-02491", "NER-", "NER-0249100000000"):
        with pytest.raises(ValidationError):
            Patient(patient_id=bad, age=56, sex="female")


def test_patient_carries_no_direct_identifier_fields():
    """PS requirement: patient ID, not unnecessary personal information."""
    from oa_core.schema import Patient
    banned = {"name", "full_name", "phone", "mobile", "address", "village",
              "aadhaar", "aadhar", "email"}
    assert not banned & set(Patient.model_fields)


def test_ordinal_items_are_bounded():
    from oa_core.schema import Questionnaire
    with pytest.raises(ValidationError):
        Questionnaire(pain_walking=5)
    with pytest.raises(ValidationError):
        Questionnaire(pain_walking=-1)


def test_schema_version_is_pinned_in_one_place():
    from oa_core import schema
    assert schema.SCHEMA_VERSION.count(".") == 2
