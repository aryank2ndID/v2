"use client";
/**
 * The posture channel of a screening.
 *
 * While the strap sensors stream the swing, the worker points the phone at the
 * patient and this reads the same walk optically — hip, knee and ankle
 * positions, and from them the knee flexion angle. It opens itself the moment
 * capture starts and closes itself when capture ends, because a camera that
 * stays on after the session is a camera nobody trusts.
 */
import * as React from "react";
import { usePoseCamera } from "@/lib/usePoseCamera";
import { Card, CardHead, Chip } from "@/components/ui";

export function ScreeningCamera({ active, label }: { active: boolean; label: string }) {
  const cam = usePoseCamera();
  const { start, stop, phase } = cam;
  const [armed, setArmed] = React.useState(false);

  // Auto-open on capture, auto-close when the session leaves it. The visitor
  // still has to have granted camera permission once — the browser enforces
  // that, and we never try to work around it.
  React.useEffect(() => {
    if (active && armed && phase === "idle") start();
    if (!active && phase === "live") stop();
  }, [active, armed, phase, start, stop]);

  const live = phase === "live";
  const fmt = (v: number | null) => (v === null ? "—" : `${Math.round(v)}°`);
  const rom = cam.angles.left !== null && cam.angles.right !== null
    ? Math.min(cam.angles.left, cam.angles.right)
    : (cam.angles.left ?? cam.angles.right);

  return (
    <Card>
      <CardHead
        title="Posture camera"
        sub={live ? `Tracking · ${label}` : "Optical check — runs beside the strap sensors"}
        right={live
          ? <Chip tone="chip-sage"><span className="dot pulse" />{cam.tracking ? `${cam.fps} fps` : "camera only"}</Chip>
          : <Chip>{armed ? "waiting for capture" : "off"}</Chip>}
      />
      <div className="card-bd">
        <div style={{
          position: "relative", borderRadius: "var(--r)", overflow: "hidden",
          background: "#07110F", aspectRatio: "4 / 3", border: "1px solid var(--line)",
        }}>
          <video ref={cam.videoRef} playsInline muted
                 style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: live ? "block" : "none" }} />
          <canvas ref={cam.canvasRef}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: live ? "block" : "none" }} />

          {!live && (
            <div style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              textAlign: "center", padding: 22, color: "rgba(255,255,255,.62)",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 620, color: "rgba(255,255,255,.88)" }}>
                  {phase === "loading" ? "Opening the camera…"
                    : armed ? "Opens automatically when capture starts"
                    : "Camera is off"}
                </div>
                <div style={{ fontSize: 12.2, marginTop: 6, lineHeight: 1.55, maxWidth: 280 }}>
                  {cam.note ?? "Stand the patient in frame, head to feet. Nothing is recorded — only angles are read."}
                </div>
              </div>
            </div>
          )}

          {live && (
            <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Readout k="Left knee" v={fmt(cam.angles.left)} />
              <Readout k="Right knee" v={fmt(cam.angles.right)} />
              <Readout k="Deepest bend" v={fmt(rom)} accent />
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 9, marginTop: 12, flexWrap: "wrap" }}>
          {live ? (
            <button className="btn btn-sm" onClick={() => { setArmed(false); stop(); }}>Turn camera off</button>
          ) : (
            <button className="btn btn-sm btn-accent" onClick={() => { setArmed(true); if (active) start(); }}>
              {armed ? "Camera armed" : "Use the camera this session"}
            </button>
          )}
          <span className="tiny dim" style={{ flex: "1 1 200px", lineHeight: 1.5 }}>
            Pose runs on this device. Published work puts markerless knee angles within about
            5° of a motion-capture lab — enough to screen with, alongside the straps.
          </span>
        </div>
      </div>
    </Card>
  );
}

function Readout({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div style={{
      background: "rgba(6,20,17,.66)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
      border: "1px solid rgba(255,255,255,.14)", borderRadius: 12, padding: "7px 12px", color: "#fff",
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 750, letterSpacing: ".12em", textTransform: "uppercase", opacity: .6 }}>{k}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15, color: accent ? "#22E0A1" : "#fff" }}>{v}</div>
    </div>
  );
}
