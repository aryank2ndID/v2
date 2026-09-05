"""Contract tests for the SANDHI model: whatever is shipped in ml/out/model.json
is the ONE thing the web and phone run. These tests fail loudly if the trained
artifact ever disagrees with the extractor, or if the tree-walk stops explaining
the score it produces.
"""
import json
import os

import numpy as np
import pytest

import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from gbm import GBM, roc_auc, brier, at_threshold, _sigmoid
from features import FEATURE_NAMES, extract, to_vector
from simulator import sample_subject, synth_session

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MODEL_JSON = os.path.join(ROOT, "out", "model.json")


# ------------------------------------------------------------- GBM core ----

def make_separable(n=400, gen=1):
    rng = np.random.default_rng(gen)
    X = rng.normal(0, 1, (n, 3))
    y = (X[:, 0] + 0.7 * X[:, 1] - 0.4 * X[:, 2] + rng.normal(0, 0.5, n) > 0).astype(int)
    return X, y


def test_gbm_fit_produces_separable_auc():
    X, y = make_separable()
    m = GBM(n_trees=60, depth=3, lr=0.1, subsample=1.0, colsample=1.0, seed=0)
    m.fit(X, y)
    p = m.predict_proba(X)
    assert roc_auc(y, p) > 0.9


def test_contributions_reconcile_exactly_with_margin():
    """The exact-explanations guarantee: margin == base + bias + sum(contribs)."""
    X, y = make_separable()
    m = GBM(n_trees=30, depth=3, lr=0.1, seed=1)
    m.fit(X, y)
    for x in X[:20]:
        c, bias = m.contributions(x)
        margin = m.margin(x.reshape(1, -1))[0]
        assert abs(margin - (m.base + bias + c.sum())) < 1e-9


def test_bias_is_lr_times_sum_of_root_values():
    X, y = make_separable()
    m = GBM(n_trees=10, depth=2, lr=0.05, seed=2)
    m.fit(X, y)
    _, bias = m.contributions(X[0])
    assert abs(bias - m.p["lr"] * sum(t.value for t in m.trees)) < 1e-12


def test_predict_proba_is_bounded():
    X, y = make_separable()
    m = GBM(n_trees=20, depth=3, lr=0.08, seed=3)
    m.fit(X, y)
    p = m.predict_proba(X)
    assert np.all((p > 0) & (p < 1))


# -------------------------------------------------------------- metrics ----

def test_roc_auc_beats_chance_on_separable_and_is_05_on_noise():
    X, y = make_separable()
    m = GBM(n_trees=40, depth=3, lr=0.1, seed=4)
    m.fit(X, y)
    assert roc_auc(y, m.predict_proba(X)) > 0.85

    rng = np.random.default_rng(0)
    y_noise = rng.integers(0, 2, 200)
    s_noise = rng.random(200)
    assert abs(roc_auc(y_noise, s_noise) - 0.5) < 0.2


def test_at_threshold_counts_add_up():
    X, y = make_separable()
    m = GBM(n_trees=30, depth=3, lr=0.1, seed=5)
    m.fit(X, y)
    t = at_threshold(y, m.predict_proba(X), 0.5)
    assert t["tp"] + t["fp"] + t["fn"] + t["tn"] == len(y)


def test_brier_is_small_on_clean_fit():
    X, y = make_separable()
    m = GBM(n_trees=80, depth=3, lr=0.1, seed=6)
    m.fit(X, y)
    assert brier(y, m.predict_proba(X)) < 0.15


# --------------------------------------------- shipped artifact contract ----

@pytest.fixture(scope="module")
def model():
    if not os.path.exists(MODEL_JSON):
        pytest.skip("ml/out/model.json not present — run ml/train.py first")
    with open(MODEL_JSON) as f:
        return json.load(f)


def test_model_features_match_extractor_contract(model):
    assert model["features"] == FEATURE_NAMES
    assert len(FEATURE_NAMES) == 27
    assert not any(n.startswith("vag_") for n in FEATURE_NAMES)


def test_exported_trees_only_split_on_contract_features(model):
    for tr in model["trees"]:
        stack = [tr]
        while stack:
            nd = stack.pop()
            if "l" in nd:
                assert 0 <= nd["f"] < 27, f"split on oob feature {nd['f']}"
                stack.append(nd["l"])
                stack.append(nd["r"])


# --------------------------------------------------- extractor behaviour ----

def test_extract_returns_all_contract_features():
    subj = sample_subject(np.random.default_rng(0))
    f = extract(synth_session(np.random.default_rng(1), subj), subj)
    assert list(f.keys()) == FEATURE_NAMES
    v = to_vector(f)
    assert v.shape == (27,)
    assert np.isfinite(v).all()


def test_extract_is_deterministic_given_same_rng():
    rng = np.random.default_rng(7)
    subj = sample_subject(rng)
    sess = synth_session(rng, subj)
    a = extract(sess, subj)
    b = extract(sess, subj)
    assert a == b


def test_intake_features_pass_through_unchanged():
    subj = sample_subject(np.random.default_rng(3))
    sess = synth_session(np.random.default_rng(4), subj)
    f = extract(sess, subj)
    for k in ["age", "sex_f", "bmi", "occ_squat_load", "womac_pain", "womac_stiff"]:
        assert f[k] == subj[k], f"{k} not passed through"


# --------------------------------------------- model + extractor + simulator ----

def test_shipped_model_ranks_simulated_subjects(model):
    """The frozen artifact must separate OA positives from negatives on fresh
    synthetic subjects — otherwise the extractor, JSON, or walk has drifted."""
    rng = np.random.default_rng(42)
    m = GBM.from_json(model)
    pos, neg = [], []
    for _ in range(120):
        subj = sample_subject(rng)
        sess = synth_session(rng, subj)
        x = to_vector(extract(sess, subj)).reshape(1, -1)
        p = float(m.predict_proba(x)[0])
        (pos if subj["label"] == 1 else neg).append(p)
    assert len(pos) and len(neg)
    assert np.mean(pos) > np.mean(neg), "shipped model does not rank-separate labels"
    assert _sigmoid(m.margin(x)[0]) == p