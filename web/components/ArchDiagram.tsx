"use client";
/** The five-layer architecture, drawn to match the design system rather than
 *  exported from a diagramming tool. Hover a layer to read what is real today. */
import * as React from "react";

interface Layer {
  id: string; n: string; title: string; sub: string;
  bg: string; line: string; ink: string;
  nodes: string[]; status: "sim" | "real" | "partial"; note: string;
}

const LAYERS: Layer[] = [
  { id: "edge", n: "1", title: "Edge device", sub: "ESP32 + 2× IMU + piezo",
    bg: "var(--sky-bg)", line: "var(--sky-line)", ink: "var(--sky-ink)",
    nodes: ["IMU — thigh", "IMU — shin", "Piezo contact mic", "ESP32 · BLE"],
    status: "sim",
    note: "Firmware is written and compiles; no board in hand, so a device emulator speaks the same BLE frame format." },
  { id: "app", n: "2", title: "Health worker app", sub: "offline-first, on-device inference",
    bg: "var(--sage-bg)", line: "var(--sage-line)", ink: "var(--sage-ink)",
    nodes: ["BLE capture", "Intake form", "Model runtime", "Outbox queue"],
    status: "real",
    note: "Real: feature extraction and the booster both run in the client with the network off." },
  { id: "api", n: "3", title: "Sync backend", sub: "Go, single static binary",
    bg: "var(--amber-bg)", line: "var(--amber-line)", ink: "var(--amber-ink)",
    nodes: ["Ingest API", "Registry", "Referral workflow", "Append-only store"],
    status: "real",
    note: "Real: stdlib-only Go server, idempotent batch ingest, cross-compiles to a PHC mini-PC." },
  { id: "ml", n: "4", title: "Model pipeline", sub: "Python, offline training",
    bg: "var(--lilac-bg)", line: "var(--lilac-line)", ink: "var(--lilac-ink)",
    nodes: ["Feature spec", "Gradient boosting", "Calibration", "Export → JSON"],
    status: "partial",
    note: "Real pipeline, synthetic cohort. Swap in field captures and rerun; nothing else changes." },
  { id: "dash", n: "5", title: "District dashboard", sub: "programme view",
    bg: "var(--blush-bg)", line: "var(--blush-line)", ink: "var(--blush-ink)",
    nodes: ["Hotspot map", "Screening counts", "Referral follow-up"],
    status: "real",
    note: "Real: renders whatever the registry holds. Today the registry holds synthetic screenings." },
];

const STATUS: Record<Layer["status"], { label: string; cls: string }> = {
  sim: { label: "Emulated", cls: "chip-amber" },
  real: { label: "Working", cls: "chip-sage" },
  partial: { label: "Real code, synthetic data", cls: "chip-lilac" },
};

export function ArchDiagram() {
  const [active, setActive] = React.useState<string | null>(null);
  const cur = LAYERS.find((l) => l.id === active);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10 }}
           className="arch-grid">
        {LAYERS.map((l, i) => (
          <div key={l.id}
               onMouseEnter={() => setActive(l.id)}
               onMouseLeave={() => setActive(null)}
               style={{
                 background: l.bg, border: `1px solid ${l.line}`, borderRadius: "var(--r)",
                 padding: "13px 13px 12px", position: "relative", cursor: "default",
                 transition: "transform .18s var(--ease), box-shadow .18s var(--ease)",
                 transform: active === l.id ? "translateY(-2px)" : "none",
                 boxShadow: active === l.id ? "var(--sh-3)" : "var(--sh-1)",
               }}>
            <div className="row between" style={{ marginBottom: 9 }}>
              <span className="num" style={{
                width: 19, height: 19, borderRadius: 6, display: "grid", placeItems: "center",
                background: l.line, color: l.ink, fontSize: 11, fontWeight: 680,
              }}>{l.n}</span>
              <span style={{
                width: 6, height: 6, borderRadius: 99,
                background: l.status === "sim" ? "var(--amber-ink)" : l.status === "real" ? "var(--sage-ink)" : "var(--lilac-ink)",
              }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13.2, color: l.ink, letterSpacing: "-0.012em" }}>{l.title}</div>
            <div style={{ fontSize: 11.2, color: l.ink, opacity: .72, marginTop: 2, lineHeight: 1.35 }}>{l.sub}</div>
            <div className="stack" style={{ gap: 4, marginTop: 10 }}>
              {l.nodes.map((nd) => (
                <div key={nd} style={{
                  fontSize: 11.2, padding: "3.5px 7px", borderRadius: 5,
                  background: "rgba(255,255,255,.66)", border: `1px solid ${l.line}`,
                  color: l.ink, letterSpacing: "-0.005em",
                }}>{nd}</div>
              ))}
            </div>
            {i < LAYERS.length - 1 && (
              <svg width="11" height="11" viewBox="0 0 16 16" style={{
                position: "absolute", right: -11, top: "50%", transform: "translateY(-50%)",
                color: "var(--ink-4)", zIndex: 2,
              }} fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 8h8M9 5l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, minHeight: 46, padding: "10px 13px", borderRadius: "var(--r-sm)",
        background: "var(--surface-2)", border: "1px solid var(--line)",
        display: "flex", gap: 11, alignItems: "center",
        transition: "background .2s var(--ease)",
      }}>
        {cur ? (
          <>
            <span className={`chip ${STATUS[cur.status].cls}`}>{STATUS[cur.status].label}</span>
            <span className="small muted" style={{ lineHeight: 1.45 }}>{cur.note}</span>
          </>
        ) : (
          <span className="small dim">Hover a layer to see what is working today and what is standing in for hardware.</span>
        )}
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .arch-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .arch-grid svg { display: none; }
        }
      `}</style>
    </div>
  );
}
