"""Pose sequence -> GaitFeatures.

One physical signal, two uses:

  * TIMING (heel strikes, stride time, variability) comes from the sub-frame
    crossing of the foot-speed threshold - a sharp edge. At 30 fps a +-1 frame
    error is ~3% of a stride, which alone would exceed the whole healthy range of
    stride-time variability, so the crossing is interpolated linearly between the
    bracketing frames. Broad position peaks are kept only as a fallback when the
    foot-speed signal is unusable.

  * PHASE (stance vs swing, double support) comes from foot-stationary detection:
    the planted foot is near-motionless in world coordinates while the body
    translates over it, so ankle speed below half the pelvis speed means stance.
    This is the 2D analogue of the zero-velocity update used on shank IMUs, so the
    camera track and the IMU track share one definition of stance.

Nothing here needs a force plate, a treadmill, or camera calibration. Every spatial
quantity is divided by the subject's own leg length, so a phone at an unknown
distance still yields comparable numbers. Absolute m/s would need a measured
walkway, so we report leg-lengths/s and say so on the report.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .pose import SIDE, PoseSequence, knee_flexion, leg_length, nanmean, smooth

# Foot is "planted" while its speed stays below this multiple of pelvis speed.
# Calibrated on the kinematic synthesiser (scripts/calibrate_gait.py): 1.1 minimises
# both stance-percent error (~1.8 pp) and symmetry-index error (~4.2 pp) across
# severities 0-0.95. Swing speed exceeds 3x pelvis speed, so the margin is wide.
STANCE_SPEED_RATIO = 1.1


@dataclass
class GaitEvents:
    heel_strikes: dict[str, np.ndarray]      # sub-frame indices (float)
    stride_times: dict[str, np.ndarray]      # seconds
    stance_mask: dict[str, np.ndarray]       # bool per frame
    hip_speed_px_s: float = 0.0
    cycles: list[tuple[int, int]] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# timing
# --------------------------------------------------------------------------- #
def _refined_peaks(x: np.ndarray, fps: float, min_gap_s: float = 0.5) -> np.ndarray:
    from scipy.signal import find_peaks
    span = float(np.nanmax(x) - np.nanmin(x))
    idx, _ = find_peaks(x, distance=max(3, int(min_gap_s * fps)),
                        prominence=max(1e-6, 0.20 * span))
    out = []
    for i in idx:
        if 0 < i < x.size - 1:
            y0, y1, y2 = x[i - 1], x[i], x[i + 1]
            denom = (y0 - 2 * y1 + y2)
            delta = 0.5 * (y0 - y2) / denom if abs(denom) > 1e-9 else 0.0
            out.append(i + float(np.clip(delta, -0.5, 0.5)))
        else:
            out.append(float(i))
    return np.asarray(out)


# --------------------------------------------------------------------------- #
# phase
# --------------------------------------------------------------------------- #
def _despeckle(mask: np.ndarray, min_run: int) -> np.ndarray:
    out = mask.copy()
    n, i = out.size, 0
    while i < n:
        j = i
        while j < n and out[j] == out[i]:
            j += 1
        if (j - i) < min_run and i > 0 and j < n:
            out[i:j] = out[i - 1]
        i = j
    return out


def _subframe_crossings(v: np.ndarray, thr: float, mask: np.ndarray) -> np.ndarray:
    """Sub-frame times (in frames) where foot speed falls through `thr` = heel strike."""
    rise = np.flatnonzero(np.diff(mask.astype(np.int8)) == 1) + 1
    out = []
    for i in rise:
        a, b = v[i - 1], v[i]
        frac = (a - thr) / (a - b) if abs(a - b) > 1e-9 else 0.0
        out.append((i - 1) + float(np.clip(frac, 0.0, 1.0)))
    return np.asarray(out)


def _hip_speed(seq: PoseSequence, min_conf: float) -> float:
    xy = seq.masked(min_conf)
    hx = nanmean(xy[:, [SIDE["L"]["hip"], SIDE["R"]["hip"]], 0], axis=1)
    hx = smooth(hx, seq.fps, cutoff_hz=3.0)
    return float(np.nanmedian(np.abs(np.gradient(hx) * seq.fps)))


def detect_events(seq: PoseSequence, min_conf: float = 0.3) -> GaitEvents:
    xy = seq.masked(min_conf)
    v_hip = _hip_speed(seq, min_conf)
    hs: dict[str, np.ndarray] = {}
    st: dict[str, np.ndarray] = {}
    masks: dict[str, np.ndarray] = {}

    for side in ("L", "R"):
        s = SIDE[side]
        rel = smooth(xy[:, s["ankle"], 0] - xy[:, s["hip"], 0], seq.fps, cutoff_hz=5.0)
        ax = smooth(xy[:, s["ankle"], 0], seq.fps, cutoff_hz=5.0)
        v_foot = np.abs(np.gradient(ax) * seq.fps)
        thr = (STANCE_SPEED_RATIO * v_hip if v_hip > 1e-6
               else 0.3 * float(np.nanpercentile(v_foot, 90)))
        rough = v_foot < thr
        stride_guess = int(seq.fps * 1.0)
        mask = _despeckle(rough, max(2, int(0.20 * stride_guess)))
        masks[side] = mask

        edges = _subframe_crossings(v_foot, thr, mask)
        if edges.size < 3:                        # fall back to position peaks
            edges = _refined_peaks(
                smooth(xy[:, s["ankle"], 0] - xy[:, s["hip"], 0], seq.fps, 5.0), seq.fps)
        hs[side] = edges
        st[side] = np.diff(edges) / seq.fps if edges.size > 1 else np.array([])

    ref = hs["L"] if hs["L"].size >= hs["R"].size else hs["R"]
    cycles = [(int(np.ceil(ref[i])), int(np.floor(ref[i + 1])))
              for i in range(ref.size - 1) if np.floor(ref[i + 1]) > np.ceil(ref[i])]
    return GaitEvents(hs, st, masks, v_hip, cycles)


def _per_cycle_fraction(mask: np.ndarray, cycles: list[tuple[int, int]]) -> float:
    """Median share of each gait cycle for which `mask` is true, in percent."""
    if mask.size == 0 or not cycles:
        return 0.0
    vals = [100.0 * float(np.mean(mask[a:b])) for a, b in cycles if b > a]
    return float(np.median(vals)) if vals else 0.0


def _step_length_norm(seq: PoseSequence, ev: GaitEvents, side: str,
                      leg_px: float, min_conf: float = 0.3) -> float:
    """Ankle separation at this limb's heel strike, in leg lengths."""
    xy = seq.masked(min_conf)
    other = "R" if side == "L" else "L"
    vals = []
    for f in ev.heel_strikes[side]:
        i = int(round(f))
        if 0 <= i < seq.n_frames:
            a, b = xy[i, SIDE[side]["ankle"], 0], xy[i, SIDE[other]["ankle"], 0]
            if np.isfinite(a) and np.isfinite(b):
                vals.append(abs(a - b) / leg_px)
    return float(np.median(vals)) if vals else 0.0


def extract(seq: PoseSequence, min_conf: float = 0.3, source: str = "cv"):
    """Returns oa_core.schema.GaitFeatures (imported lazily to keep packages decoupled)."""
    from oa_core.schema import GaitFeatures

    leg_px = float(nanmean(np.array([leg_length(seq, "L", min_conf),
                                     leg_length(seq, "R", min_conf)])))
    if not np.isfinite(leg_px) or leg_px <= 1:
        return GaitFeatures(source=source, quality=0.0)

    ev = detect_events(seq, min_conf)
    strides = np.concatenate([ev.stride_times["L"], ev.stride_times["R"]])
    strides = strides[np.isfinite(strides)]
    stride_time = float(np.median(strides)) if strides.size else 0.0
    cadence = 120.0 / stride_time if stride_time > 0 else 0.0
    cv = float(np.std(strides) / np.mean(strides) * 100.0) if strides.size > 2 else 0.0

    speed_norm = (ev.hip_speed_px_s / leg_px) if leg_px else 0.0

    kf = {s: smooth(knee_flexion(seq, s, min_conf), seq.fps) for s in ("L", "R")}
    rom = {s: float(np.nanpercentile(v, 97) - np.nanpercentile(v, 3)) for s, v in kf.items()}
    stance_peak: dict[str, float] = {}
    for s in ("L", "R"):
        vals = [float(np.nanmax(kf[s][a:a + max(2, int(0.35 * (b - a)))]))
                for a, b in ev.cycles if b > a]
        stance_peak[s] = float(np.median(vals)) if vals else 0.0

    return GaitFeatures(
        source=source,
        quality=round(seq.quality(min_conf), 3),
        cadence_spm=round(min(200.0, cadence), 2),
        gait_speed_norm=round(min(3.0, speed_norm), 3),
        stride_time_s=round(stride_time, 3),
        stride_time_cv_pct=round(min(60.0, cv), 2),
        double_support_pct=round(_per_cycle_fraction(
            ev.stance_mask["L"] & ev.stance_mask["R"], ev.cycles), 2),
        stance_pct_l=round(_per_cycle_fraction(ev.stance_mask["L"], ev.cycles), 2),
        stance_pct_r=round(_per_cycle_fraction(ev.stance_mask["R"], ev.cycles), 2),
        step_length_norm_l=round(min(2.0, _step_length_norm(seq, ev, "L", leg_px)), 3),
        step_length_norm_r=round(min(2.0, _step_length_norm(seq, ev, "R", leg_px)), 3),
        knee_flex_peak_stance_l=round(float(np.clip(stance_peak["L"], -10, 90)), 2),
        knee_flex_peak_stance_r=round(float(np.clip(stance_peak["R"], -10, 90)), 2),
        knee_rom_gait_l=round(float(np.clip(rom["L"], 0, 90)), 2),
        knee_rom_gait_r=round(float(np.clip(rom["R"], 0, 90)), 2),
    )
