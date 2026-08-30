"""Pose backends behind one interface, chosen at runtime.

  synthetic  - procedural walker. No camera, no download, no hardware. Runs in CI.
  movenet    - MoveNet SinglePose Lightning as ONNX via onnxruntime. This is the
               deployment target: the same .onnx file runs in onnxruntime-react-native
               on the phone, so laptop and device produce identical keypoints.
  mediapipe  - BlazePose. Better landmarks (it has feet), but the wheel does not
               build for every Python version - notably NOT for the 3.14 interpreter
               on this machine. Kept as an opt-in backend, never a hard dependency.

Adding a backend means adding a class here and nothing else: gait.py, posture.py and
rom.py only ever see a PoseSequence.
"""
from __future__ import annotations

from pathlib import Path
from typing import Protocol

import numpy as np

from .pose import IDX, K, PoseSequence

MODELS_DIR = Path(__file__).resolve().parents[3] / "artifacts" / "pose"

# MoveNet/COCO-17 -> our 19-slot layout (feet are absent, left as NaN)
MOVENET_ORDER = ["nose", "l_eye", "r_eye", "l_ear", "r_ear", "l_shoulder", "r_shoulder",
                 "l_elbow", "r_elbow", "l_wrist", "r_wrist", "l_hip", "r_hip",
                 "l_knee", "r_knee", "l_ankle", "r_ankle"]


class PoseBackend(Protocol):
    name: str

    def run_video(self, path: str, max_frames: int = 900) -> PoseSequence: ...


class SyntheticBackend:
    name = "synthetic"

    def __init__(self, severity: float = 0.0, affected: str = "L", seed: int = 0):
        self.severity, self.affected, self.seed = severity, affected, seed

    def run_video(self, path: str = "", max_frames: int = 900) -> PoseSequence:
        from .synth import synthesise, truth_for_severity
        seq, _ = synthesise(truth_for_severity(self.severity, self.affected, self.seed),
                            seed=self.seed)
        return seq


class MoveNetOnnxBackend:
    """Expects artifacts/pose/movenet_lightning.onnx (see docs/models.md for the fetch)."""

    name = "movenet"

    def __init__(self, model_path: Path | None = None, input_size: int = 192):
        self.model_path = model_path or (MODELS_DIR / "movenet_lightning.onnx")
        self.input_size = input_size
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"{self.model_path} missing - run scripts/fetch_pose_model.sh, "
                "or use --backend synthetic")
        import onnxruntime as ort
        self.sess = ort.InferenceSession(str(self.model_path),
                                         providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name

    def _frame(self, img: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        import cv2
        h, w = img.shape[:2]
        side = max(h, w)
        pad = np.zeros((side, side, 3), dtype=img.dtype)
        pad[:h, :w] = img
        small = cv2.resize(pad, (self.input_size, self.input_size))
        x = small[None].astype(np.int32)
        out = np.asarray(self.sess.run(None, {self.inp: x})[0]).reshape(-1, 3)
        xy = np.full((K, 2), np.nan, dtype=np.float32)
        conf = np.zeros(K, dtype=np.float32)
        for i, name in enumerate(MOVENET_ORDER):
            ky, kx, kc = out[i]
            xy[IDX[name]] = (kx * side, ky * side)
            conf[IDX[name]] = kc
        return xy, conf

    def run_video(self, path: str, max_frames: int = 900) -> PoseSequence:
        import cv2
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frames, confs = [], []
        while len(frames) < max_frames:
            ok, img = cap.read()
            if not ok:
                break
            xy, c = self._frame(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            frames.append(xy)
            confs.append(c)
        cap.release()
        if not frames:
            raise RuntimeError(f"no frames decoded from {path}")
        return PoseSequence(np.stack(frames), np.stack(confs), float(fps))


class MediaPipeBackend:
    name = "mediapipe"
    MAP = {"nose": 0, "l_eye": 2, "r_eye": 5, "l_ear": 7, "r_ear": 8,
           "l_shoulder": 11, "r_shoulder": 12, "l_elbow": 13, "r_elbow": 14,
           "l_wrist": 15, "r_wrist": 16, "l_hip": 23, "r_hip": 24,
           "l_knee": 25, "r_knee": 26, "l_ankle": 27, "r_ankle": 28,
           "l_foot": 31, "r_foot": 32}

    def __init__(self, complexity: int = 1):
        try:
            import mediapipe as mp
        except ImportError as e:
            raise ImportError(
                "mediapipe is not installed for this interpreter (no wheel for "
                "Python 3.14). Create a 3.12 env for it, or use --backend movenet."
            ) from e
        self._pose = mp.solutions.pose.Pose(model_complexity=complexity,
                                            smooth_landmarks=True)

    def run_video(self, path: str, max_frames: int = 900) -> PoseSequence:
        import cv2
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        w = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1.0
        h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1.0
        frames, confs = [], []
        while len(frames) < max_frames:
            ok, img = cap.read()
            if not ok:
                break
            res = self._pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
            xy = np.full((K, 2), np.nan, dtype=np.float32)
            conf = np.zeros(K, dtype=np.float32)
            if res.pose_landmarks:
                lm = res.pose_landmarks.landmark
                for name, i in self.MAP.items():
                    xy[IDX[name]] = (lm[i].x * w, lm[i].y * h)
                    conf[IDX[name]] = lm[i].visibility
            frames.append(xy)
            confs.append(conf)
        cap.release()
        if not frames:
            raise RuntimeError(f"no frames decoded from {path}")
        return PoseSequence(np.stack(frames), np.stack(confs), float(fps))


def get_backend(name: str, **kw) -> PoseBackend:
    if name == "synthetic":
        return SyntheticBackend(**kw)
    if name == "movenet":
        return MoveNetOnnxBackend(**kw)
    if name == "mediapipe":
        return MediaPipeBackend(**kw)
    raise ValueError(f"unknown pose backend {name!r}")
