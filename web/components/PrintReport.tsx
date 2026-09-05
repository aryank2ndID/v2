"use client";

import React from "react";
import { createPortal } from "react-dom";
import { BAND_LABEL, FEATURE_LABEL, FEATURE_UNIT, formatFeature } from "@/lib/store";

export type PrintProps = {
  patient: string;
  district?: string;
  date: string;
  risk: number;
  band: "low" | "watch" | "refer";
  bands?: { low: number; refer: number };
  top: { feature: string; value: number; contribution: number }[];
  captureSeconds?: number;
  causal?: boolean;
};

function kv(label: string, value: React.ReactNode) {
  return (
    <div className="pr-kv">
      <span className="pr-k">{label}</span>
      <span className="pr-v">{value}</span>
    </div>
  );
}

/**
 * SINGLE sheet carrying the patient-visible result: the input snapshot, the
 * banded outcome, and the top contributing signals. Purpose-built for print /
 * Save as PDF, so a health worker leaves the village with the same paper a
 * clinic can read off-line. Never shows a bare log-odds.
 *
 * Portal strategy: the sheet is mounted on document.body (not inside .app) so
 * the print stylesheet can safely `display: none` the whole app shell without
 * hiding the report, and no ancestor transform/containing-block can clip it.
 */
function pct0(p: number) {
  return (p * 100).toFixed(1) + "%";
}

function PrintSheet({ patient, district, date, risk, band, bands, top, captureSeconds, causal }: PrintProps) {
  const tone = band === "low" ? "#1f6f43" : band === "watch" ? "#8a5a00" : "#a23b2a";
  return (
    <section className="pr" data-band={band}>
      <header className="pr-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center",
            background: "#e9f3ed", color: "#1f6f43", fontWeight: 800, fontSize: 15,
          }}>সা</span>
          <div>
            <div style={{ fontWeight: 800, letterSpacing: "-0.02em", fontSize: 15 }}>SANDHI — Knee Screening</div>
            <div className="pr-sub">Digital-Health Screening Aid · North-East Region</div>
          </div>
        </div>
        <div className="pr-date">{date}</div>
      </header>

      <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
        <div style={{ flex: "1.15", border: "1px solid #dfe6e2", borderRadius: 10, padding: "14px 15px" }}>
          <div className="pr-eyebrow">Result</div>
          <div className="pr-band" style={{ color: tone }}>{BAND_LABEL[band]}</div>
          <div className="pr-index">index {Math.round(risk * 100)}/100</div>
          <div className="pr-track">
            <span style={{ width: `${Math.max(0.5, risk * 100)}%`, background: tone }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#7a827d", marginTop: 4 }}>
            <span>low ≤ {bands ? pct0(bands.low) : "10%"}</span>
            <span>watch ≤ {bands ? pct0(bands.refer) : "18.5%"}</span>
            <span>refer &gt; {bands ? pct0(bands.refer) : "18.5%"}</span>
          </div>
        </div>

        <div style={{ flex: 1, border: "1px solid #dfe6e2", borderRadius: 10, padding: "14px 15px" }}>
          <div className="pr-eyebrow">Patient</div>
          {kv("Name", patient)}
          {district ? kv("District", district) : null}
          {captureSeconds ? kv("Capture", `${captureSeconds}s walk + sit-to-stand`) : null}
          {kv("Tool", "SANDHI wearable app")}
        </div>
      </div>

      <table className="pr-table">
        <caption className="pr-eyebrow" style={{ textAlign: "left", paddingBottom: 6 }}>
          Top contributing signals{causal ? " (ordered by direct effect on this score)" : ""}
        </caption>
        <thead>
          <tr><th style={{ textAlign: "left" }}>Signal</th><th style={{ textAlign: "right" }}>Value</th><th style={{ textAlign: "right" }}>Pull toward refer</th></tr>
        </thead>
        <tbody>
          {top.map((e) => (
            <tr key={e.feature}>
              <td>{FEATURE_LABEL[e.feature] ?? e.feature}</td>
              <td style={{ textAlign: "right" }}>
                {formatFeature(e.feature, e.value)}{FEATURE_UNIT[e.feature] ? ` ${FEATURE_UNIT[e.feature]}` : ""}
              </td>
              <td style={{ textAlign: "right", fontWeight: 600, color: e.contribution > 0 ? "#a23b2a" : "#1f6f43" }}>
                {e.contribution > 0 ? "up" : "down"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="pr-foot">
        Screening aid only — this is not a diagnosis of osteoarthritis. Risk is a model
        likelihood from a 14,000-screening synthetic benchmark (AUC 0.93). In real-world
        community data the gait-only model holds (AUC 0.78); treat "refer" as reason to
        confirm at a clinic, not as a finding. Values above are the snapshot fed to the model.
      </footer>
    </section>
  );
}

export default function PrintReport(props: PrintProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<PrintSheet {...props} />, document.body);
}