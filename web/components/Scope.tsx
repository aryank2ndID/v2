"use client";
/** Rolling waveform display — the same thing you would see on a bench scope. */
import * as React from "react";

export function Scope({
  data, height = 62, color = "var(--sky-ink)", fill = "var(--sky-bg)",
  window: win = 320, label, unit, live, yRange,
}: {
  data: ArrayLike<number>; height?: number; color?: string; fill?: string;
  window?: number; label?: string; unit?: string; live?: boolean;
  yRange?: [number, number];
}) {
  const n = data.length;
  const start = Math.max(0, n - win);
  const slice: number[] = [];
  const step = Math.max(1, Math.floor((n - start) / win));
  for (let i = start; i < n; i += step) slice.push(data[i]);

  let lo: number, hi: number;
  if (yRange) { [lo, hi] = yRange; }
  else {
    lo = Infinity; hi = -Infinity;
    for (const v of slice) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = -1; hi = 1; }
    const pad = (hi - lo) * 0.12 || 1;
    lo -= pad; hi += pad;
  }
  const rng = hi - lo || 1;
  const W = 1000;
  const pts = slice.map((v, i) => [
    (i / Math.max(1, slice.length - 1)) * W,
    height - ((v - lo) / rng) * (height - 4) - 2,
  ]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(2)}`).join(" ");

  return (
    <div style={{ position: "relative" }}>
      {(label || unit) && (
        <div className="between" style={{ marginBottom: 4 }}>
          <span className="eyebrow" style={{ fontSize: 9.6 }}>{label}</span>
          <span className="tiny faint num">
            {slice.length ? slice[slice.length - 1].toFixed(1) : "—"} {unit}
          </span>
        </div>
      )}
      <div style={{
        background: "var(--surface-2)", border: "1px solid var(--line)",
        borderRadius: "var(--r-xs)", overflow: "hidden", position: "relative",
      }}>
        <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none"
             style={{ display: "block" }}>
          <line x1="0" x2={W} y1={height / 2} y2={height / 2} stroke="var(--line)" strokeWidth={1}
                vectorEffect="non-scaling-stroke" />
          {slice.length > 1 && (
            <>
              <path d={`${d} L${W} ${height} L0 ${height} Z`} fill={fill} opacity={0.7} />
              <path d={d} fill="none" stroke={color} strokeWidth={1.3}
                    vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            </>
          )}
        </svg>
        {live && (
          <span className="pulse" style={{
            position: "absolute", top: 5, right: 6, width: 5, height: 5,
            borderRadius: 99, background: "var(--clay-ink)",
          }} />
        )}
      </div>
    </div>
  );
}

/** 24-band spectral strip for the joint microphone. */
export function SpectrumStrip({ bands, centers, height = 54 }: {
  bands: number[]; centers: number[]; height?: number;
}) {
  const max = Math.max(...bands, 1e-15);
  return (
    <div>
      <div className="row" style={{ gap: 1.5, height, alignItems: "flex-end" }}>
        {bands.map((b, i) => {
          const h = Math.max(2, (Math.log10(b / max + 1e-6) + 6) / 6 * height);
          const hot = centers[i] > 200;
          return (
            <div key={i} title={`${centers[i].toFixed(0)} Hz`} style={{
              flex: 1, height: h, borderRadius: "2px 2px 0 0",
              background: hot ? "var(--blush-line)" : "var(--sky-line)",
              transition: "height .25s var(--ease)",
            }} />
          );
        })}
      </div>
      <div className="between tiny faint" style={{ marginTop: 3 }}>
        <span>20 Hz</span><span style={{ color: "var(--blush-ink)" }}>200 Hz — crepitus band →</span><span>950 Hz</span>
      </div>
    </div>
  );
}
