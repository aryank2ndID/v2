"""Procedural gait synthesiser: a walking skeleton with KNOWN ground truth.

Why this exists (it is not a toy):
  1. The whole pipeline is demoable and unit-testable on day 1 with no camera,
     no ESP32, and no dataset download.
  2. It gives the extractor a round-trip test: we set cadence/ROM/asymmetry,
     synthesise pose, run the extractor, and assert the numbers come back. A
     gait algorithm nobody has round-trip tested is a gait algorithm that is wrong.
  3. It is NEVER a source of training labels for the clinical model. Synthetic
     pose validates code; real cohorts validate clinical claims. Keep that line.

Joint trajectories follow the textbook shape of the sagittal knee/hip angle
curves (stance flexion wave ~15 deg near 15% of cycle, swing peak ~60 deg near
73%); `severity` deforms them the way knee OA does: stiff-knee swing, extension
lag, slower cadence, shorter and asymmetric steps, higher variability.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

import numpy as np

from .pose import IDX, K, PoseSequence

LEG_PX = 200.0
THIGH_F, SHANK_F = 0.48, 0.52
TRUNK_F, FOOT_F = 0.62, 0.20


@dataclass
class GaitTruth:
    cadence_spm: float = 108.0
    stride_len_norm: float = 1.35          # in leg lengths, both steps
    stance_pct_l: float = 61.0
    stance_pct_r: float = 61.0
    knee_swing_peak_l: float = 60.0
    knee_swing_peak_r: float = 60.0
    knee_stance_peak_l: float = 16.0
    knee_stance_peak_r: float = 16.0
    ext_deficit_l: float = 0.0
    ext_deficit_r: float = 0.0
    hip_amp: float = 22.0
    trunk_lean_deg: float = 2.0
    stride_cv_pct: float = 2.0
    step_len_ratio_lr: float = 1.0
    fps: float = 30.0
    duration_s: float = 8.0
    noise_px: float = 1.2
    dropout: float = 0.02
    # filled in by synthesise(): what the generated signal actually contains.
    # Requested stride_cv_pct is smoothed by the phase generator, so tests must
    # compare against these, never against the request.
    actual_cadence_spm: float = 0.0
    actual_stride_cv_pct: float = 0.0

    @property
    def stride_freq_hz(self) -> float:
        return self.cadence_spm / 120.0

    @property
    def speed_norm(self) -> float:
        return self.stride_len_norm * self.stride_freq_hz


def truth_for_severity(severity: float, affected: str = "L",
                       seed: int = 0, **over) -> GaitTruth:
    """severity 0 = healthy adult, 1 = advanced unilateral knee OA presentation."""
    s = float(np.clip(severity, 0.0, 1.0))
    rng = np.random.default_rng(seed)
    t = GaitTruth(
        cadence_spm=112.0 - 26.0 * s + rng.normal(0, 2.5),
        stride_len_norm=1.40 - 0.34 * s + rng.normal(0, 0.03),
        hip_amp=22.0 - 5.0 * s,
        trunk_lean_deg=2.0 + 7.0 * s,
        stride_cv_pct=2.0 + 6.5 * s,
        fps=30.0, duration_s=8.0,
    )
    aff, sound = affected, ("R" if affected == "L" else "L")
    setattr(t, f"knee_swing_peak_{aff.lower()}", 60.0 - 24.0 * s)
    setattr(t, f"knee_swing_peak_{sound.lower()}", 60.0 - 4.0 * s)
    setattr(t, f"knee_stance_peak_{aff.lower()}", 16.0 - 7.0 * s)
    setattr(t, f"knee_stance_peak_{sound.lower()}", 16.0 - 1.0 * s)
    setattr(t, f"ext_deficit_{aff.lower()}", 9.0 * s)
    # offload the painful limb: less time on it, longer stance on the sound side
    setattr(t, f"stance_pct_{aff.lower()}", 61.0 - 5.0 * s)
    setattr(t, f"stance_pct_{sound.lower()}", 61.0 + 5.0 * s)
    t.step_len_ratio_lr = (1.0 - 0.22 * s) if affected == "L" else 1.0 / (1.0 - 0.22 * s)
    for k, v in over.items():
        setattr(t, k, v)
    return t


def _cycle_phase(n: int, truth: GaitTruth, rng: np.random.Generator) -> np.ndarray:
    """Cumulative gait phase in cycles, with stride-to-stride variability."""
    dt = 1.0 / truth.fps
    base = truth.stride_freq_hz
    jitter = rng.normal(0.0, truth.stride_cv_pct / 100.0, size=n)
    freq = base * (1.0 + np.clip(jitter, -0.35, 0.35))
    freq = np.convolve(freq, np.ones(9) / 9.0, mode="same")   # correlate over a stride
    return np.cumsum(freq) * dt


def _knee_curve(ph: np.ndarray, stance_peak: float, swing_peak: float,
                deficit: float) -> np.ndarray:
    p = np.mod(ph, 1.0)
    stance_wave = stance_peak * np.exp(-0.5 * ((p - 0.15) / 0.09) ** 2)
    swing_wave = swing_peak * np.exp(-0.5 * ((p - 0.73) / 0.12) ** 2)
    return deficit + stance_wave + swing_wave



def _warp_phase(ph: np.ndarray, stance_frac: float, nominal: float = 0.61) -> np.ndarray:
    """Piecewise-linear phase warp that changes how long a limb spends in stance
    while preserving the shape of the joint-angle curves.

    Real knee OA shortens stance on the painful limb (offloading) and lengthens it
    on the sound limb. Without this, temporal asymmetry would be a parameter the
    synthesiser accepted and silently ignored - the extractor could never recover
    it, and the round-trip test would be meaningless.
    """
    stance_frac = float(np.clip(stance_frac, 0.35, 0.85))
    cyc = np.floor(ph)
    p = ph - cyc
    out = np.where(p <= stance_frac,
                   p * (nominal / stance_frac),
                   nominal + (p - stance_frac) * ((1.0 - nominal) / (1.0 - stance_frac)))
    return cyc + out


def _solve_hip_angle(d: np.ndarray, knee: np.ndarray, thigh: float,
                     shank: float, iters: int = 14) -> np.ndarray:
    """Inverse kinematics: hip flexion that puts the ankle at horizontal offset `d`.

    Solves  thigh*sin(t) + shank*sin(t - knee) = d  by Newton iteration. This is
    what makes the planted foot actually STAY planted: during stance the foot is a
    fixed world point and the hip angle is whatever the geometry demands, exactly
    as in real walking. A synthesiser that instead prescribes a sinusoidal hip
    angle produces a foot that skates along the ground, and any stance/swing
    detector validated against it is being validated against a physical lie.
    """
    reach = 0.98 * (thigh + shank)
    d = np.clip(d, -reach, reach)
    t = np.zeros_like(d)
    for _ in range(iters):
        f = thigh * np.sin(t) + shank * np.sin(t - knee) - d
        df = thigh * np.cos(t) + shank * np.cos(t - knee)
        t = t - f / np.where(np.abs(df) < 1e-6, 1e-6, df)
        t = np.clip(t, -1.2, 1.2)
    return t


def _smoothstep(u: np.ndarray) -> np.ndarray:
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def synthesise(truth: GaitTruth, seed: int = 0) -> tuple[PoseSequence, GaitTruth]:
    """Kinematically consistent sagittal walker.

    Construction order matters: footfalls are laid down on the ground first, then
    the hip angle is solved so the stance foot never moves, then the pelvis height
    is dropped out of the planted leg's length. Vertical pelvis oscillation and
    double support therefore emerge from the model instead of being faked.
    """
    rng = np.random.default_rng(seed)
    n = int(round(truth.duration_s * truth.fps))
    ph = _cycle_phase(n, truth, rng)                     # unwarped phase, cycles
    thigh, shank = LEG_PX * THIGH_F, LEG_PX * SHANK_F
    trunk, foot = LEG_PX * TRUNK_F, LEG_PX * FOOT_F

    stride_px = truth.stride_len_norm * LEG_PX
    r = max(0.3, truth.step_len_ratio_lr)
    step_l = stride_px * r / (1.0 + r)                   # R->L step  (noqa: F841 kept for clarity)
    step_r = stride_px / (1.0 + r)                       # L->R step
    v_px_frame = truth.speed_norm * LEG_PX / truth.fps
    hip_x = np.arange(n) * v_px_frame - 0.30 * stride_px
    ground_y = 620.0

    xy = np.full((n, K, 2), np.nan, dtype=np.float32)
    theta: dict[str, np.ndarray] = {}
    knee_ang: dict[str, np.ndarray] = {}
    stance: dict[str, np.ndarray] = {}
    # R lands one step AFTER the L footfall of the previous cycle, so its own
    # cycle index is one ahead - miss this and the R leg is asked to reach a
    # footfall a full stride away, which the IK silently clamps into nonsense.
    offset_x = {"L": 0.0, "R": step_r - stride_px}

    for side, ph_off in (("L", 0.0), ("R", 0.5)):
        lo = side.lower()
        p = ph + ph_off
        sf = float(np.clip(getattr(truth, f"stance_pct_{lo}") / 100.0, 0.35, 0.85))
        w = _warp_phase(p, sf)
        knee = np.radians(_knee_curve(w, getattr(truth, f"knee_stance_peak_{lo}"),
                                     getattr(truth, f"knee_swing_peak_{lo}"),
                                     getattr(truth, f"ext_deficit_{lo}")))
        frac = p - np.floor(p)
        st = frac <= sf
        cyc = np.floor(p)
        footfall = cyc * stride_px + offset_x[side]
        th = _solve_hip_angle(footfall - hip_x, knee, thigh, shank)

        # swing: interpolate from the toe-off angle to the angle the NEXT footfall needs
        nxt = _solve_hip_angle((cyc + 1.0) * stride_px + offset_x[side] - hip_x,
                               knee, thigh, shank)
        i = 0
        while i < n:
            if st[i]:
                i += 1
                continue
            j = i
            while j < n and not st[j]:
                j += 1
            a = th[i - 1] if i > 0 else th[i]
            b = nxt[j] if j < n else nxt[-1]
            u = _smoothstep((np.arange(i, j) - i + 1) / float(max(1, j - i)))
            th[i:j] = a + (b - a) * u
            i = j
        theta[side], knee_ang[side], stance[side] = th, knee, st

    # pelvis height: whatever the planted leg's effective length requires
    eff = {s: thigh * np.cos(theta[s]) + shank * np.cos(theta[s] - knee_ang[s])
           for s in ("L", "R")}
    both = stance["L"].astype(float) + stance["R"].astype(float)
    weighted = (stance["L"] * eff["L"] + stance["R"] * eff["R"])
    fallback = np.minimum(eff["L"], eff["R"])
    hip_y = ground_y - np.where(both > 0, weighted / np.maximum(both, 1e-6), fallback)

    lean = np.radians(truth.trunk_lean_deg)
    for side in ("L", "R"):
        lo = side.lower()
        th, knee = theta[side], knee_ang[side]
        kx = hip_x + thigh * np.sin(th)
        ky = hip_y + thigh * np.cos(th)
        seg = th - knee
        ax = kx + shank * np.sin(seg)
        ay = ky + shank * np.cos(seg)
        xy[:, IDX[f"{lo}_hip"]] = np.stack([hip_x, hip_y], -1)
        xy[:, IDX[f"{lo}_knee"]] = np.stack([kx, ky], -1)
        xy[:, IDX[f"{lo}_ankle"]] = np.stack([ax, ay], -1)
        xy[:, IDX[f"{lo}_foot"]] = np.stack([ax + foot * np.cos(seg * 0.4),
                                            ay + foot * 0.10], -1)
        xy[:, IDX[f"{lo}_shoulder"]] = np.stack(
            [hip_x + trunk * np.sin(lean), hip_y - trunk * np.cos(lean)], -1)

    xy[:, IDX["nose"]] = xy[:, IDX["l_shoulder"]] + np.array([6.0, -55.0], dtype=np.float32)
    xy += rng.normal(0.0, truth.noise_px, size=xy.shape).astype(np.float32)
    conf = np.where(np.isfinite(xy[..., 0]), 0.92, 0.0).astype(np.float32)
    conf[rng.random(conf.shape) < truth.dropout] = 0.05

    hs_t = _crossing_times(ph, truth.fps)
    if hs_t.size > 2:
        strides = np.diff(hs_t)
        truth.actual_cadence_spm = float(120.0 / np.mean(strides))
        truth.actual_stride_cv_pct = float(np.std(strides) / np.mean(strides) * 100.0)
    return PoseSequence(xy=np.nan_to_num(xy, nan=0.0), conf=conf, fps=truth.fps), truth


def _crossing_times(ph: np.ndarray, fps: float) -> np.ndarray:
    """Times (s) at which the gait phase crosses each whole cycle - the true heel
    strikes of the generated signal, with sub-frame linear interpolation."""
    out = []
    for c in range(int(np.floor(ph[0])) + 1, int(np.floor(ph[-1])) + 1):
        i = int(np.searchsorted(ph, c))
        if 0 < i < ph.size:
            frac = (c - ph[i - 1]) / max(1e-9, ph[i] - ph[i - 1])
            out.append((i - 1 + frac) / fps)
    return np.asarray(out)


def synthesise_frontal(varus_deg: float = 0.0, pelvic_obliq_deg: float = 0.0,
                       sway_norm: float = 0.4, seconds: float = 10.0,
                       fps: float = 30.0, seed: int = 0) -> PoseSequence:
    """Quiet-stance frontal view for posture/alignment + balance."""
    rng = np.random.default_rng(seed)
    n = int(seconds * fps)
    xy = np.full((n, K, 2), np.nan, dtype=np.float32)
    t = np.arange(n) / fps
    sway_ml = sway_norm * 6.0 * np.sin(2 * np.pi * 0.35 * t) + rng.normal(0, 0.8, n)
    sway_ap = sway_norm * 4.0 * np.sin(2 * np.pi * 0.55 * t + 1.1) + rng.normal(0, 0.6, n)
    cx = 320.0 + sway_ml
    hip_y, half_w = 420.0, 0.16 * LEG_PX
    for side, sgn in (("L", -1.0), ("R", 1.0)):
        lo = side.lower()
        obl = np.radians(pelvic_obliq_deg)   # sgn is applied to the offset, not the angle
        hx = cx + sgn * half_w
        hy = hip_y + sway_ap + sgn * half_w * np.tan(obl)
        # varus displaces the knee LATERALLY off the hip-ankle line, on both legs
        knee_shift = np.tan(np.radians(varus_deg)) * LEG_PX * THIGH_F * sgn
        kx = hx + knee_shift
        ky = hy + LEG_PX * THIGH_F
        ax = hx.copy()
        ay = ky + LEG_PX * SHANK_F
        xy[:, IDX[f"{lo}_hip"]] = np.stack([hx, hy], -1)
        xy[:, IDX[f"{lo}_knee"]] = np.stack([kx, ky], -1)
        xy[:, IDX[f"{lo}_ankle"]] = np.stack([ax, ay], -1)
        xy[:, IDX[f"{lo}_shoulder"]] = np.stack(
            [hx + sgn * 0.02 * LEG_PX, hy - LEG_PX * TRUNK_F], -1)
    xy += rng.normal(0, 1.0, xy.shape).astype(np.float32)
    conf = np.where(np.isfinite(xy[..., 0]), 0.9, 0.0).astype(np.float32)
    return PoseSequence(np.nan_to_num(xy), conf, fps, view="frontal")


def truth_dict(t: GaitTruth) -> dict:
    d = asdict(t)
    d.update(speed_norm=round(t.speed_norm, 3), stride_freq_hz=round(t.stride_freq_hz, 3))
    return d
