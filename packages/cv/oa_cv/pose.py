"""Canonical pose representation + geometry helpers.

Every backend (MoveNet ONNX, MediaPipe, IMU-derived, synthetic) is adapted into
ONE keypoint layout so the gait/posture/ROM extractors never know or care which
sensor produced the data. Backends that cannot see a landmark write NaN, and every
downstream metric is NaN-aware - that is what makes a 'not captured' field on the
report honest instead of a silent zero.

Layout: COCO-17 + two optional foot landmarks (MediaPipe provides them, MoveNet
does not). Coordinates are pixels or normalised units, y DOWN (image convention).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

NAMES = ["nose", "l_eye", "r_eye", "l_ear", "r_ear", "l_shoulder", "r_shoulder",
         "l_elbow", "r_elbow", "l_wrist", "r_wrist", "l_hip", "r_hip",
         "l_knee", "r_knee", "l_ankle", "r_ankle", "l_foot", "r_foot"]
IDX = {n: i for i, n in enumerate(NAMES)}
K = len(NAMES)

SIDE = {"L": {"hip": IDX["l_hip"], "knee": IDX["l_knee"], "ankle": IDX["l_ankle"],
              "foot": IDX["l_foot"], "shoulder": IDX["l_shoulder"]},
        "R": {"hip": IDX["r_hip"], "knee": IDX["r_knee"], "ankle": IDX["r_ankle"],
              "foot": IDX["r_foot"], "shoulder": IDX["r_shoulder"]}}


@dataclass
class PoseSequence:
    """xy: (T, K, 2) float32, conf: (T, K) float32 in 0..1, fps: frames/second."""

    xy: np.ndarray
    conf: np.ndarray
    fps: float
    view: str = "sagittal"          # 'sagittal' (side-on walk) | 'frontal'

    def __post_init__(self) -> None:
        if self.xy.ndim != 3 or self.xy.shape[1] != K or self.xy.shape[2] != 2:
            raise ValueError(f"xy must be (T,{K},2), got {self.xy.shape}")
        self.xy = self.xy.astype(np.float32)
        self.conf = self.conf.astype(np.float32)

    @property
    def n_frames(self) -> int:
        return int(self.xy.shape[0])

    @property
    def duration_s(self) -> float:
        return self.n_frames / self.fps

    def masked(self, min_conf: float = 0.3) -> np.ndarray:
        out = self.xy.copy()
        out[self.conf < min_conf] = np.nan
        return out

    def quality(self, min_conf: float = 0.3) -> float:
        """Fraction of lower-limb landmarks tracked across the clip."""
        limb = [IDX[n] for n in ("l_hip", "r_hip", "l_knee", "r_knee",
                                 "l_ankle", "r_ankle")]
        return float(np.mean(self.conf[:, limb] >= min_conf))


def nanmean(a: np.ndarray, axis: int | None = None) -> np.ndarray:
    """np.nanmean without the all-NaN RuntimeWarning.

    An all-NaN slice is the normal case for a frame where the tracker lost the
    subject, not an anomaly worth a warning on every camp assessment.
    """
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(a, axis=axis)


def angle_3pt(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> np.ndarray:
    """Interior angle at b, in degrees. Works on (T,2) stacks; NaN-safe."""
    v1, v2 = a - b, c - b
    n1 = np.linalg.norm(v1, axis=-1)
    n2 = np.linalg.norm(v2, axis=-1)
    cos = np.einsum("...i,...i->...", v1, v2) / np.maximum(n1 * n2, 1e-9)
    return np.degrees(np.arccos(np.clip(cos, -1.0, 1.0)))


def knee_flexion(seq: PoseSequence, side: str, min_conf: float = 0.3) -> np.ndarray:
    """Knee flexion series in degrees (0 = fully extended)."""
    xy = seq.masked(min_conf)
    s = SIDE[side]
    interior = angle_3pt(xy[:, s["hip"]], xy[:, s["knee"]], xy[:, s["ankle"]])
    return 180.0 - interior


def leg_length(seq: PoseSequence, side: str, min_conf: float = 0.3) -> float:
    """Hip->knee->ankle chain length, the scale used to normalise every distance.

    Normalising by leg length is what lets a phone at an unknown distance from the
    patient still produce comparable numbers - no calibration target needed.
    """
    xy = seq.masked(min_conf)
    s = SIDE[side]
    thigh = np.linalg.norm(xy[:, s["hip"]] - xy[:, s["knee"]], axis=-1)
    shank = np.linalg.norm(xy[:, s["knee"]] - xy[:, s["ankle"]], axis=-1)
    return float(np.nanmedian(thigh + shank))


def smooth(x: np.ndarray, fps: float, cutoff_hz: float = 6.0) -> np.ndarray:
    """Zero-lag low-pass. Gait harmonics live below ~6 Hz; pose jitter is above it."""
    from scipy.signal import butter, filtfilt
    x = np.asarray(x, dtype=float)
    if x.shape[0] < 12 or not np.isfinite(x).any():
        return x
    filled = _interp_nan(x)
    wn = min(0.99, cutoff_hz / (0.5 * fps))
    b, a = butter(2, wn)
    return filtfilt(b, a, filled, axis=0)


def _interp_nan(x: np.ndarray) -> np.ndarray:
    x = x.copy()
    if x.ndim == 1:
        idx = np.arange(x.size)
        good = np.isfinite(x)
        if good.sum() < 2:
            return np.nan_to_num(x)
        x[~good] = np.interp(idx[~good], idx[good], x[good])
        return x
    for j in range(x.shape[1]):
        x[:, j] = _interp_nan(x[:, j])
    return x
