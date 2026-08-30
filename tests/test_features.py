"""The feature vector is the ML contract. A silent reordering here would make a
trained artifact predict from the wrong columns and never raise."""
import numpy as np
import pytest


@pytest.fixture
def blank():
    from oa_core.schema import (Assessment, GaitFeatures, JointFeatures, Patient,
                                PostureFeatures, Questionnaire)
    return Assessment(assessment_id="as-test000000", patient=Patient(
        patient_id="NER-TEST", age=44, sex="male", height_cm=170, weight_kg=70),
        questionnaire=Questionnaire(), gait=GaitFeatures(), joint=JointFeatures(),
        posture=PostureFeatures())


def test_vector_length_matches_the_declared_count(blank):
    from oa_core import features
    v = features.to_vector(blank)
    assert v.shape == (features.N_FEATURES,)
    assert len(features.FEATURE_NAMES) == features.N_FEATURES
    assert len(set(features.FEATURE_NAMES)) == features.N_FEATURES


def test_vector_order_follows_feature_names(blank):
    from oa_core import features
    d = features.to_dict(blank)
    v = features.to_vector(blank)
    for i, name in enumerate(features.FEATURE_NAMES):
        assert v[i] == pytest.approx(float(d[name])), f"column {i} ({name}) misaligned"


def test_vector_is_finite_even_with_nothing_captured(blank):
    """NaN reaching sklearn is a crash in a camp, not a warning."""
    from oa_core import features
    assert np.isfinite(features.to_vector(blank)).all()


def test_to_dict_raises_if_a_declared_feature_is_dropped(blank, monkeypatch):
    from oa_core import features
    monkeypatch.setattr(features, "FEATURE_NAMES",
                        [*features.FEATURE_NAMES, "feature_that_does_not_exist"])
    with pytest.raises(KeyError):
        features.to_dict(blank)


def test_modality_masks_report_what_was_actually_captured(blank):
    from oa_core import features
    d = features.to_dict(blank)
    assert d["has_gait"] == 0.0 and d["has_joint"] == 0.0
    walked = blank.model_copy(update={
        "gait": blank.gait.model_copy(update={"cadence_spm": 104.0, "gait_speed_norm": 1.1,
                                             "source": "cv"})})
    assert features.to_dict(walked)["has_gait"] == 1.0


def test_coverage_is_a_fraction_and_rises_with_each_modality(blank):
    from oa_core import features
    empty = features.modality_coverage(blank)
    assert 0.0 <= empty <= 1.0
    full = blank.model_copy(update={
        "gait": blank.gait.model_copy(update={"cadence_spm": 104.0, "gait_speed_norm": 1.1}),
        "joint": blank.joint.model_copy(update={"knee_flex_max_l": 120.0, "knee_flex_max_r": 118.0}),
        "posture": blank.posture.model_copy(update={"sway_area_norm": 0.5}),
    })
    assert features.modality_coverage(full) > empty


def test_worst_side_aggregation_picks_the_worse_knee_not_the_mean(blank):
    """Unilateral OA is the common presentation. Averaging the two knees would
    hide a 90 deg knee behind a healthy 135 deg one."""
    from oa_core import features
    a = blank.model_copy(update={"joint": blank.joint.model_copy(
        update={"knee_flex_max_l": 90.0, "knee_flex_max_r": 135.0})})
    d = features.to_dict(a)
    assert d["knee_flex_max_worst"] == pytest.approx(90.0)
    b = blank.model_copy(update={"joint": blank.joint.model_copy(
        update={"knee_flex_max_l": 135.0, "knee_flex_max_r": 90.0})})
    assert features.to_dict(b)["knee_flex_max_worst"] == pytest.approx(90.0), \
        "worst-side aggregation must be side-agnostic"
    lag = blank.model_copy(update={"joint": blank.joint.model_copy(
        update={"knee_ext_deficit_l": 2.0, "knee_ext_deficit_r": 11.0})})
    assert features.to_dict(lag)["knee_ext_deficit_worst"] == pytest.approx(11.0), \
        "for a deficit, worse means larger"
