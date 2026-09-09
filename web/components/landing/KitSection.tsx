"use client";
/**
 * What the kit is actually made of. Every part here is a real, orderable
 * component — the firmware in packages/firmware/esp32_imu is written against
 * exactly this hardware (ESP32 + Adafruit MPU6050 driver), and the placement
 * follows the standard lateral thigh / lateral shank pair used in the IMU
 * gait literature.
 */
import * as React from "react";
import { GlowCard } from "@/components/landing/fx";

interface Part {
  name: string; what: string; spec: string; tone: string; icon: React.ReactNode;
}

const PARTS: Part[] = [
  {
    name: "Two motion sensors",
    what: "One strapped above the knee, one below. They feel the leg swing.",
    spec: "MPU-6050 · 3-axis motion + 3-axis turn · ±2000°/s · 15×20×2 mm",
    tone: "#22E0A1",
    icon: <ChipIcon />,
  },
  {
    name: "A small radio brain",
    what: "Reads both sensors a hundred times a second and passes it to the phone over Bluetooth.",
    spec: "ESP32-WROOM-32 · Bluetooth LE · 20-byte frames · CRC-checked",
    tone: "#0FC2C0",
    icon: <BoardIcon />,
  },
  {
    name: "A rechargeable cell",
    what: "Runs a full day of camp screening, and charges from any phone charger.",
    spec: "18650 Li-ion 2600 mAh + TP4056 · about 25 screenings per charge",
    tone: "#3B93FF",
    icon: <BatteryIcon />,
  },
  {
    name: "Two cloth straps",
    what: "Neoprene and velcro. Goes on over clothing in about forty seconds.",
    spec: "Washable · adjustable 28–60 cm · sensor sits in a printed pocket",
    tone: "#8B5CF6",
    icon: <StrapIcon />,
  },
  {
    name: "Printed housings",
    what: "Keeps each sensor flat against the leg, so the reading stays honest.",
    spec: "PLA, printed locally · snap-fit · drop-tested to 1.2 m",
    tone: "#FFC145",
    icon: <BoxIcon />,
  },
  {
    name: "The worker's own phone",
    what: "Runs the app and works out the answer. Nothing extra to buy or carry.",
    spec: "Any Android 8+ · works fully offline",
    tone: "#FF6B6B",
    icon: <PhoneIcon />,
  },
];

export function KitSection() {
  return (
    <div style={{ display: "grid", gap: 26, gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)", alignItems: "start" }}
         className="lp-kit-grid">
      <div style={{ display: "grid", gap: 12 }}>
        {PARTS.map((p, i) => (
          <GlowCard key={p.name} className="lp-rise" tone={p.tone} style={{ ["--d" as string]: i }}>
            <div className="lp-part">
              <span className="lp-part-ic" style={{ background: `color-mix(in srgb, ${p.tone} 16%, transparent)`, color: p.tone }}>
                {p.icon}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="lp-h3" style={{ fontSize: 17.5 }}>{p.name}</span>
                <p className="lp-body" style={{ marginTop: 5, fontSize: 14.5 }}>{p.what}</p>
                <p style={{
                  marginTop: 8, fontSize: 11.8, fontFamily: "var(--mono)", color: "var(--ink-3)",
                  letterSpacing: "-.01em", lineHeight: 1.5,
                }}>{p.spec}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      <aside className="lp-kit-stage lp-scale" style={{ position: "sticky", top: 100 }}>
        <PlacementDiagram />
        <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--edge)" }}>
          <div className="lp-kicker" style={{ color: "var(--ink-3)", marginBottom: 10 }}>Made to be repairable</div>
          <p className="lp-small">
            Nothing here is glued shut or proprietary. A district can print more housings, swap a
            cell, or replace a sensor from a local supplier — without waiting on anybody's
            service centre.
          </p>
        </div>
      </aside>

      <style>{`@media (max-width: 1040px){ .lp-kit-grid{ grid-template-columns: minmax(0,1fr) !important } }`}</style>
    </div>
  );
}

/** Where the two sensors go, and why there. */
function PlacementDiagram() {
  return (
    <div>
      <div className="lp-kicker" style={{ color: "var(--ink-3)", marginBottom: 14 }}>Where it goes</div>
      <svg viewBox="0 0 220 300" width="100%" style={{ display: "block", maxHeight: 340, margin: "0 auto" }} aria-hidden>
        <defs>
          <linearGradient id="legG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#22E0A1" stopOpacity=".22" />
            <stop offset="1" stopColor="#3B93FF" stopOpacity=".14" />
          </linearGradient>
        </defs>

        {/* leg silhouette */}
        <path d="M96 14 C 88 46, 86 82, 92 116 L 96 132 C 100 152, 104 170, 100 196
                 L 96 240 C 94 258, 94 268, 96 280 L 128 280 C 128 264, 128 250, 126 236
                 L 124 194 C 126 168, 128 148, 132 128 L 136 112 C 140 76, 136 44, 128 14 Z"
              fill="url(#legG)" stroke="var(--edge-2)" strokeWidth="1.5" />

        {/* femur / tibia hint */}
        <path d="M112 26 L110 124" stroke="var(--ink-3)" strokeWidth="2.4" strokeLinecap="round" opacity=".45" />
        <path d="M110 146 L112 264" stroke="var(--ink-3)" strokeWidth="2.4" strokeLinecap="round" opacity=".45" />

        {/* knee joint */}
        <circle cx="111" cy="135" r="13" fill="var(--card)" stroke="#FF6B6B" strokeWidth="2" />
        <path d="M100 135 q 11 7, 22 0" stroke="#FF6B6B" strokeWidth="2" fill="none" strokeLinecap="round" />
        <text x="132" y="139" fontSize="11" fontWeight="700" fill="#FF6B6B">the joint</text>

        {/* upper cuff */}
        <rect x="82" y="92" width="58" height="18" rx="9" fill="var(--card)" stroke="#22E0A1" strokeWidth="2.4" />
        <circle cx="98" cy="101" r="3" fill="#22E0A1" /><circle cx="111" cy="101" r="3" fill="#22E0A1" /><circle cx="124" cy="101" r="3" fill="#22E0A1" />
        <line x1="140" y1="101" x2="176" y2="78" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x="152" y="72" fontSize="11.5" fontWeight="700" fill="var(--ink-1)">Sensor 1</text>
        <text x="152" y="85" fontSize="10" fill="var(--ink-3)">15 cm above</text>

        {/* lower cuff */}
        <rect x="82" y="168" width="56" height="18" rx="9" fill="var(--card)" stroke="#0FC2C0" strokeWidth="2.4" />
        <circle cx="97" cy="177" r="3" fill="#0FC2C0" /><circle cx="110" cy="177" r="3" fill="#0FC2C0" /><circle cx="123" cy="177" r="3" fill="#0FC2C0" />
        <line x1="138" y1="177" x2="176" y2="200" stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x="150" y="205" fontSize="11.5" fontWeight="700" fill="var(--ink-1)">Sensor 2</text>
        <text x="150" y="218" fontSize="10" fill="var(--ink-3)">10 cm below</text>

        {/* angle arc between the two */}
        <path d="M 76 110 A 46 46 0 0 0 76 168" fill="none" stroke="#8B5CF6" strokeWidth="2" className="lp-anglearc" />
        <text x="12" y="144" fontSize="10.5" fontWeight="700" fill="#8B5CF6">bend angle</text>
      </svg>
      <p className="lp-small" style={{ marginTop: 10, textAlign: "center" }}>
        The difference between what the two sensors feel <em>is</em> the knee bend. That is the
        whole trick — no sensor sits on the joint itself.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ icons */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function ChipIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /><path d="M10 3v3.5M14 3v3.5M10 17.5V21M14 17.5V21M3 10h3.5M3 14h3.5M17.5 10H21M17.5 14H21" /></svg>; }
function BoardIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M7 9h5M7 12.5h3" /><circle cx="17" cy="14" r="2.2" /></svg>; }
function BatteryIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><rect x="2.5" y="7" width="16" height="10" rx="3" /><path d="M21.5 11v2" /><path d="M11.5 9.5 9 12.5h3l-2 2.5" /></svg>; }
function StrapIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><path d="M4 8c5-2.5 11-2.5 16 0M4 16c5 2.5 11 2.5 16 0" /><rect x="9" y="9.5" width="6" height="5" rx="1.6" /></svg>; }
function BoxIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4M12 11v10" /></svg>; }
function PhoneIcon() { return <svg width="21" height="21" viewBox="0 0 24 24" {...S}><rect x="6.5" y="2.5" width="11" height="19" rx="2.8" /><path d="M10.5 5.5h3" /></svg>; }
