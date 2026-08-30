"""Frontal-view quiet stance -> PostureFeatures, plus static knee alignment.

The frontal clip is 10 s of the patient standing still, feet hip-width, camera at
hip height 2-3 m away. It buys three things the sagittal walk cannot give:
alignment (varus/valgus), pelvic obliquity, and postural sway.

Sway is reported as a normalised area, not millimetres: without a calibration
target we cannot claim mm, and inventing units is how a screening tool loses
credibility on its first audit.
"""
from __future__ import annotations

import numpy as np

from .pose import IDX, PoseSequence, leg_length, nanmean, smooth


def _mid(xy: np.ndarray, a: str, b: str) -> np.ndarray:
    return 0.5 * (xy[:, IDX[a]] + xy[:, IDX[b]])


def _tilt_deg(xy: np.ndarray, left: str, right: str) -> float:
    """Signed tilt of the left-right line from horizontal, degrees."""
    d = xy[:, IDX[right]] - xy[:, IDX[left]]
    ang = np.degrees(np.arctan2(d[:, 1], np.where(np.abs(d[:, 0]) < 1e-6, 1e-6, d[:, 0])))
    return float(np.nanmedian(ang))


def varus_valgus_deg(seq: PoseSequence, side: str, min_conf: float = 0.3) -> float:
    """Frontal hip-knee-ankle deviation. Negative = varus (bow-leg), positive = valgus.

    Sign convention is mirrored per side so that 'varus' means the same thing on
    both legs - the single most common bug in frontal-plane alignment code.
    """
    xy = seq.masked(min_conf)
    lo = side.lower()
    hip, knee, ankle = (xy[:, IDX[f"{lo}_hip"]], xy[:, IDX[f"{lo}_knee"]],
                        xy[:, IDX[f"{lo}_ankle"]])
    span = ankle - hip
    t = np.where(np.abs(span[:, 1]) < 1e-6, 1e-6, span[:, 1])
    expected_x = hip[:, 0] + span[:, 0] * ((knee[:, 1] - hip[:, 1]) / t)
    offset = knee[:, 0] - expected_x            # + = knee lateral to the hip-ankle line
    thigh_len = np.linalg.norm(knee - hip, axis=-1)
    ang = np.degrees(np.arctan2(offset, np.maximum(thigh_len, 1e-6)))
    # lateral knee deviation = varus = negative, on both legs
    signed = -ang if side == "R" else ang
    return float(np.clip(np.nanmedian(signed), -30, 30))


def extract(seq: PoseSequence, min_conf: float = 0.3, source: str = "cv"):
    """Returns (PostureFeatures, {varus_valgus_deg_l, varus_valgus_deg_r})."""
    from oa_core.schema import PostureFeatures

    xy = seq.masked(min_conf)
    leg_px = float(nanmean(np.array([leg_length(seq, "L", min_conf),
                                     leg_length(seq, "R", min_conf)])))
    if not np.isfinite(leg_px) or leg_px <= 1:
        return PostureFeatures(source=source), {"varus_valgus_deg_l": 0.0,
                                                "varus_valgus_deg_r": 0.0}

    pelvis = _mid(xy, "l_hip", "r_hip")
    shoulder = _mid(xy, "l_shoulder", "r_shoulder")
    trunk = shoulder - pelvis
    lean = float(np.nanmedian(np.degrees(np.arctan2(
        trunk[:, 0], -np.where(np.abs(trunk[:, 1]) < 1e-6, -1e-6, trunk[:, 1])))))

    cx = smooth(pelvis[:, 0], seq.fps, cutoff_hz=3.0)
    cy = smooth(pelvis[:, 1], seq.fps, cutoff_hz=3.0)
    # 95% confidence-ellipse area of the pelvis centroid, in units of 1e-3 leg^2
    sway = float(1000.0 * 5.99 * np.pi * np.nanstd(cx) * np.nanstd(cy) / (leg_px ** 2))

    width = float(np.nanmedian(np.abs(xy[:, IDX["l_ankle"], 0]
                                      - xy[:, IDX["r_ankle"], 0])) / leg_px)
    feats = PostureFeatures(
        source=source,
        trunk_lean_deg=round(float(np.clip(lean, -30, 45)), 2),
        pelvic_obliquity_deg=round(float(np.clip(_tilt_deg(xy, "l_hip", "r_hip"), -20, 20)), 2),
        shoulder_tilt_deg=round(float(np.clip(
            _tilt_deg(xy, "l_shoulder", "r_shoulder"), -20, 20)), 2),
        stance_width_norm=round(min(2.0, width), 3),
        sway_area_norm=round(float(np.clip(sway, 0, 5)), 3),
    )
    align = {"varus_valgus_deg_l": round(varus_valgus_deg(seq, "L", min_conf), 2),
             "varus_valgus_deg_r": round(varus_valgus_deg(seq, "R", min_conf), 2)}
    return feats, align
