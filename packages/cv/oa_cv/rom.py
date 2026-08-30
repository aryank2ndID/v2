"""Guided joint tests -> JointFeatures.

Three short clips, each with an on-screen prompt in the worker's language:
  1. seated active knee flexion/extension, one side at a time  -> ROM, extension lag
  2. five-times sit-to-stand from a fixed-height stool          -> sts5_time_s
  3. timed up-and-go over a 3 m marked line                     -> tug_time_s

Repetition counting is peak-based on the trunk-to-thigh angle rather than on
absolute positions, so it survives the camera being nudged mid-test - which it
will be, in a tent, on uneven ground.
"""
from __future__ import annotations

import numpy as np

from .pose import IDX, SIDE, PoseSequence, angle_3pt, knee_flexion, smooth


def rom_from_clip(seq: PoseSequence, side: str, min_conf: float = 0.3) -> tuple[float, float]:
    """(peak flexion, extension deficit) in degrees for one knee."""
    kf = smooth(knee_flexion(seq, side, min_conf), seq.fps, cutoff_hz=4.0)
    if not np.isfinite(kf).any():
        return 0.0, 0.0
    peak = float(np.nanpercentile(kf, 98))
    deficit = float(np.nanpercentile(kf, 2))
    return round(float(np.clip(peak, 0, 160)), 1), round(float(np.clip(deficit, -10, 45)), 1)


def _trunk_thigh_angle(seq: PoseSequence, min_conf: float = 0.3) -> np.ndarray:
    """Hip angle proxy: shoulder-hip-knee. Small when seated, large when standing."""
    xy = seq.masked(min_conf)
    sh = 0.5 * (xy[:, IDX["l_shoulder"]] + xy[:, IDX["r_shoulder"]])
    hip = 0.5 * (xy[:, IDX["l_hip"]] + xy[:, IDX["r_hip"]])
    knee = 0.5 * (xy[:, IDX["l_knee"]] + xy[:, IDX["r_knee"]])
    return angle_3pt(sh, hip, knee)


def sit_to_stand(seq: PoseSequence, min_conf: float = 0.3,
                 n_reps: int = 5) -> tuple[float, int]:
    """(total seconds for n_reps, reps detected). Returns 0.0 if fewer reps are seen."""
    from scipy.signal import find_peaks
    ang = smooth(_trunk_thigh_angle(seq, min_conf), seq.fps, cutoff_hz=3.0)
    if not np.isfinite(ang).any():
        return 0.0, 0
    span = float(np.nanmax(ang) - np.nanmin(ang))
    peaks, _ = find_peaks(ang, distance=int(0.6 * seq.fps),
                          prominence=max(1.0, 0.35 * span))
    if peaks.size < 2:
        return 0.0, int(peaks.size)
    reps = int(peaks.size)
    total = float((peaks[-1] - peaks[0]) / seq.fps)
    if reps >= n_reps:                       # scale to exactly n_reps intervals
        per = total / (reps - 1)
        return round(per * (n_reps - 1), 2), reps
    return round(total, 2), reps


def timed_up_and_go(seq: PoseSequence, min_conf: float = 0.3) -> float:
    """Seconds from first pelvis rise to final pelvis settle."""
    xy = seq.masked(min_conf)
    hip_y = smooth(0.5 * (xy[:, IDX["l_hip"], 1] + xy[:, IDX["r_hip"], 1]),
                   seq.fps, cutoff_hz=3.0)
    if not np.isfinite(hip_y).any():
        return 0.0
    lo, hi = np.nanpercentile(hip_y, 95), np.nanpercentile(hip_y, 5)
    mid = 0.5 * (lo + hi)
    moving = np.flatnonzero(hip_y < mid)      # y is DOWN, so standing = smaller y
    if moving.size < 2:
        return 0.0
    return round(float((moving[-1] - moving[0]) / seq.fps), 2)


def extract(rom_clips: dict[str, PoseSequence] | None = None,
            sts_clip: PoseSequence | None = None,
            tug_clip: PoseSequence | None = None,
            alignment: dict[str, float] | None = None,
            min_conf: float = 0.3, source: str = "cv"):
    """Assemble JointFeatures from whichever clips the worker managed to capture."""
    from oa_core.schema import JointFeatures

    vals: dict[str, float] = {}
    for side in ("L", "R"):
        clip = (rom_clips or {}).get(side)
        if clip is not None:
            peak, deficit = rom_from_clip(clip, side, min_conf)
            vals[f"knee_flex_max_{side.lower()}"] = peak
            vals[f"knee_ext_deficit_{side.lower()}"] = max(0.0, deficit)
    if sts_clip is not None:
        vals["sts5_time_s"] = sit_to_stand(sts_clip, min_conf)[0]
    if tug_clip is not None:
        vals["tug_time_s"] = timed_up_and_go(tug_clip, min_conf)
    if alignment:
        vals.update({k: v for k, v in alignment.items() if k.startswith("varus")})
    return JointFeatures(source=source, **vals)
