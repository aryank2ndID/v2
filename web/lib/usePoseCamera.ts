"use client";
/**
 * Camera + markerless pose tracking, as one reusable piece.
 *
 * MediaPipe's BlazePose landmarker runs in-tab against WASM and a model served
 * from /public — no network call at run time, which is the same constraint the
 * rest of the system works under. From the landmarks we compute knee flexion
 * (hip → knee → ankle), the quantity packages/cv/oa_cv/rom.py extracts from a
 * recorded screening. Frames go video → canvas → discarded; nothing is stored.
 */
import * as React from "react";

export type PosePhase = "idle" | "loading" | "live" | "error";

export interface Pt { x: number; y: number; visibility?: number }

/* BlazePose 33-point topology, trimmed to torso + legs. Face and finger
   points carry no information for a knee screening. */
const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
  [11, 13], [13, 15], [12, 14], [14, 16],
];
const LEG_POINTS = new Set([23, 24, 25, 26, 27, 28]);

/** Interior angle at `b` in degrees — 180° is a straight leg. */
export function angleAt(a: Pt, b: Pt, c: Pt) {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!mag) return 0;
  const cos = (abx * cbx + aby * cby) / mag;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

interface Landmarker { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: Pt[][] }; close?: () => void }

export function usePoseCamera() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef(0);
  const lmRef = React.useRef<Landmarker | null>(null);

  const [phase, setPhase] = React.useState<PosePhase>("idle");
  const [note, setNote] = React.useState<string | null>(null);
  const [tracking, setTracking] = React.useState(false);
  const [seen, setSeen] = React.useState(false);
  const [angles, setAngles] = React.useState<{ left: number | null; right: number | null }>({ left: null, right: null });
  const [fps, setFps] = React.useState(0);

  const stop = React.useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try { lmRef.current?.close?.(); } catch { /* already gone */ }
    lmRef.current = null;
    setTracking(false);
    setSeen(false);
    setAngles({ left: null, right: null });
    setPhase("idle");
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  const runLoop = React.useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let last = performance.now();
    let frames = 0;

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const lm = lmRef.current;
      if (!lm || video.readyState < 2) return;

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      let people: Pt[][] | undefined;
      try { people = lm.detectForVideo(video, performance.now()).landmarks; } catch { return; }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const person = people?.[0];

      if (person?.length) {
        setSeen(true);
        const P = (i: number) => ({ x: person[i].x * canvas.width, y: person[i].y * canvas.height });
        const vis = (i: number) => person[i].visibility ?? 1;

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "#22E0A1");
        grad.addColorStop(0.55, "#3B93FF");
        grad.addColorStop(1, "#8B5CF6");

        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(3, canvas.width / 190);
        ctx.strokeStyle = grad;
        ctx.shadowColor = "rgba(34,224,161,.6)";
        ctx.shadowBlur = 14;
        BONES.forEach(([a, b]) => {
          if (vis(a) < 0.4 || vis(b) < 0.4) return;
          const p1 = P(a), p2 = P(b);
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        });

        ctx.shadowBlur = 0;
        person.forEach((p, i) => {
          if (vis(i) < 0.4 || (i > 16 && !LEG_POINTS.has(i))) return;
          const leg = LEG_POINTS.has(i);
          const pt = P(i);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, leg ? canvas.width / 130 : canvas.width / 210, 0, Math.PI * 2);
          ctx.fillStyle = leg ? "#FFFFFF" : "rgba(255,255,255,.7)";
          ctx.fill();
          if (leg) { ctx.lineWidth = 2.5; ctx.strokeStyle = "#0FC2C0"; ctx.stroke(); }
        });

        const knee = (hip: number, kn: number, ank: number) =>
          Math.min(vis(hip), vis(kn), vis(ank)) < 0.55 ? null : angleAt(person[hip], person[kn], person[ank]);
        const left = knee(23, 25, 27);
        const right = knee(24, 26, 28);
        setAngles({ left, right });

        ([[25, left], [26, right]] as [number, number | null][]).forEach(([idx, val]) => {
          if (val === null) return;
          const k = P(idx);
          ctx.beginPath();
          ctx.arc(k.x, k.y, canvas.width / 26, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(34,224,161,.85)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      } else {
        setSeen(false);
        setAngles({ left: null, right: null });
      }

      frames++;
      const now = performance.now();
      if (now - last > 500) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
    };

    loop();
  }, []);

  const start = React.useCallback(async () => {
    setPhase("loading");
    setNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("live");

      // Pose tracking is an extra layer on top of a working camera: if the
      // model cannot load, the preview still runs and we say so rather than
      // failing the whole panel.
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
        lmRef.current = (await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "/models/pose_landmarker_lite.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })) as unknown as Landmarker;
        setTracking(true);
        runLoop();
      } catch {
        setNote("Camera is live, but posture tracking could not start on this device.");
      }
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setPhase("error");
      setNote(
        name === "NotAllowedError" ? "Camera permission was declined. Allow it and press the button again."
        : name === "NotFoundError" ? "No camera found on this device."
        : name === "NotReadableError" ? "Another app is already using the camera."
        : "The camera could not be opened on this device."
      );
    }
  }, [runLoop]);

  return { videoRef, canvasRef, phase, note, tracking, seen, angles, fps, start, stop };
}
