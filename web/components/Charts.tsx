"use client";
/**
 * Charts, drawn by hand in SVG.
 *
 * No charting dependency: the field bundle has to stay small and work offline,
 * and every one of these is under 60 lines. It also means the visual language
 * (hairlines, tabular numerals, the pastel ramp) is consistent everywhere
 * instead of fighting a library's defaults.
 */
import * as React from "react";

export const RAMP = [
  "var(--sky-line)", "var(--sage-line)", "var(--amber-line)",
  "var(--lilac-line)", "var(--blush-line)", "var(--clay-line)",
];
export const RAMP_INK = [
  "var(--sky-ink)", "var(--sage-ink)", "var(--amber-ink)",
  "var(--lilac-ink)", "var(--blush-ink)", "var(--clay-ink)",
];

const nice = (v: number) => {
  const e = Math.pow(10, Math.floor(Math.log10(Math.abs(v) || 1)));
  const f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
};

/* ------------------------------------------------------------- sparkline -- */
export function Sparkline({ data, w = 92, h = 26, stroke = "var(--sky-ink)", fill }: {
  data: number[]; w?: number; h?: number; stroke?: string; fill?: string;
}) {
  if (!data.length) return null;
  const lo = Math.min(...data), hi = Math.max(...data);
  const rng = hi - lo || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - lo) / rng) * (h - 3) - 1.5]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={fill} opacity={0.5} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2} fill={stroke} />
    </svg>
  );
}

/* ------------------------------------------------------------ line chart -- */
export function LineChart({ series, height = 190, yLabel, xLabels, yMax, area = true }: {
  series: { name: string; data: number[]; color?: string }[];
  height?: number; yLabel?: string; xLabels?: string[]; yMax?: number; area?: boolean;
}) {
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const [w, setW] = React.useState(640);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const iw = Math.max(60, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const n = Math.max(...series.map((s) => s.data.length), 2);
  const hi = yMax ?? nice(Math.max(...series.flatMap((s) => s.data), 1) * 1.12);
  const X = (i: number) => pad.l + (i / (n - 1)) * iw;
  const Y = (v: number) => pad.t + ih - (v / hi) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * hi);

  return (
    <div ref={ref}>
      <svg width="100%" height={height} style={{ display: "block", overflow: "visible" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={Y(t)} y2={Y(t)} stroke="var(--line-soft)" strokeWidth={1} />
            <text x={pad.l - 7} y={Y(t) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" className="num">
              {t >= 1000 ? `${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k` : t % 1 ? t.toFixed(1) : t}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const color = s.color ?? RAMP_INK[si % RAMP_INK.length];
          const d = s.data.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(2)} ${Y(v).toFixed(2)}`).join(" ");
          return (
            <g key={s.name}>
              {area && (
                <path d={`${d} L${X(s.data.length - 1)} ${Y(0)} L${X(0)} ${Y(0)} Z`}
                      fill={color} opacity={0.075} />
              )}
              <path d={d} fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {xLabels?.map((l, i) =>
          l ? (
            <text key={i} x={X(i)} y={height - 7} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)">{l}</text>
          ) : null
        )}
        {yLabel && (
          <text x={pad.l - 30} y={pad.t - 2} fontSize={10} fill="var(--ink-3)" className="eyebrow">{yLabel}</text>
        )}
      </svg>
      {series.length > 1 && (
        <div className="row wrap" style={{ gap: 14, marginTop: 8, paddingLeft: pad.l }}>
          {series.map((s, i) => (
            <span key={s.name} className="row tiny dim" style={{ gap: 5 }}>
              <span style={{ width: 9, height: 2.5, borderRadius: 2, background: s.color ?? RAMP_INK[i % RAMP_INK.length] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ bar chart --- */
export function HBars({ items, max, fmt, height = 15 }: {
  items: { label: string; value: number; color?: string; note?: string }[];
  max?: number; fmt?: (v: number) => string; height?: number;
}) {
  const hi = max ?? Math.max(...items.map((i) => i.value), 1e-9);
  return (
    <div className="stack" style={{ gap: 9 }}>
      {items.map((it, i) => (
        <div key={it.label + i} className="row" style={{ gap: 10 }}>
          <div style={{ flex: "0 0 156px", fontSize: 12.4, color: "var(--ink-2)", textAlign: "right", lineHeight: 1.25 }}>
            {it.label}
          </div>
          <div className="grow" style={{ position: "relative" }}>
            <div style={{
              height, borderRadius: 4, width: `${Math.max(1.5, (it.value / hi) * 100)}%`,
              background: it.color ?? "var(--sky-line)", transition: "width .5s var(--ease)",
            }} />
          </div>
          <div className="num tiny" style={{ flex: "0 0 62px", color: "var(--ink-2)", fontWeight: 540 }}>
            {fmt ? fmt(it.value) : it.value.toFixed(3)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- donut --- */
export function Donut({ slices, size = 132, thickness = 17, center }: {
  slices: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; center?: React.ReactNode;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: `0 0 ${size}px` }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {slices.map((s) => {
          const frac = s.value / total;
          const el = (
            <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={s.color} strokeWidth={thickness}
                    strokeDasharray={`${frac * C - 1.6} ${C}`}
                    strokeDashoffset={-acc * C} strokeLinecap="round" />
          );
          acc += frac;
          return el;
        })}
      </svg>
      {center && (
        <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          textAlign: "center", lineHeight: 1.15,
        }}>{center}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ ROC --- */
export function RocCurve({ points, marker, size = 216 }: {
  points: [number, number][]; marker?: { spec: number; sens: number }; size?: number;
}) {
  const pad = 26;
  const X = (spec: number) => pad + (1 - spec) * (size - pad - 8);
  const Y = (sens: number) => size - pad - sens * (size - pad - 8);
  const sorted = [...points].sort((a, b) => b[0] - a[0]);
  const d = sorted.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(" ");
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <rect x={pad} y={8} width={size - pad - 8} height={size - pad - 8} fill="var(--surface-2)" rx={4} />
      {[0.25, 0.5, 0.75].map((t) => (
        <g key={t}>
          <line x1={X(1 - t)} x2={X(1 - t)} y1={8} y2={size - pad} stroke="var(--line-soft)" />
          <line x1={pad} x2={size - 8} y1={Y(t)} y2={Y(t)} stroke="var(--line-soft)" />
        </g>
      ))}
      <line x1={X(1)} y1={Y(0)} x2={X(0)} y2={Y(1)} stroke="var(--ink-4)" strokeDasharray="3 3" strokeWidth={1} />
      <path d={`${d} L${X(0)} ${Y(0)} Z`} fill="var(--sky-ink)" opacity={0.09} />
      <path d={d} fill="none" stroke="var(--sky-ink)" strokeWidth={1.9} strokeLinejoin="round" />
      {marker && (
        <>
          <circle cx={X(marker.spec)} cy={Y(marker.sens)} r={5.5} fill="var(--clay-bg)" stroke="var(--clay-ink)" strokeWidth={1.8} />
          <circle cx={X(marker.spec)} cy={Y(marker.sens)} r={1.7} fill="var(--clay-ink)" />
        </>
      )}
      <text x={pad + (size - pad) / 2 - 8} y={size - 5} fontSize={9.5} fill="var(--ink-4)" textAnchor="middle">1 − specificity</text>
      <text x={9} y={size / 2} fontSize={9.5} fill="var(--ink-4)" textAnchor="middle" transform={`rotate(-90 9 ${size / 2})`}>sensitivity</text>
    </svg>
  );
}

/* ---------------------------------------------------------- calibration --- */
export function CalibrationPlot({ bins, size = 216 }: {
  bins: { predicted: number; observed: number; n: number }[]; size?: number;
}) {
  const pad = 26;
  const X = (v: number) => pad + v * (size - pad - 8);
  const Y = (v: number) => size - pad - v * (size - pad - 8);
  const maxN = Math.max(...bins.map((b) => b.n), 1);
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <rect x={pad} y={8} width={size - pad - 8} height={size - pad - 8} fill="var(--surface-2)" rx={4} />
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--ink-4)" strokeDasharray="3 3" strokeWidth={1} />
      <path d={bins.map((b, i) => `${i ? "L" : "M"}${X(b.predicted).toFixed(1)} ${Y(b.observed).toFixed(1)}`).join(" ")}
            fill="none" stroke="var(--sage-ink)" strokeWidth={1.6} />
      {bins.map((b, i) => (
        <circle key={i} cx={X(b.predicted)} cy={Y(b.observed)}
                r={3 + 4 * Math.sqrt(b.n / maxN)} fill="var(--sage-bg)"
                stroke="var(--sage-ink)" strokeWidth={1.4} />
      ))}
      <text x={pad + (size - pad) / 2 - 8} y={size - 5} fontSize={9.5} fill="var(--ink-4)" textAnchor="middle">predicted risk</text>
      <text x={9} y={size / 2} fontSize={9.5} fill="var(--ink-4)" textAnchor="middle" transform={`rotate(-90 9 ${size / 2})`}>observed rate</text>
    </svg>
  );
}

/* --------------------------------------------------------- distribution -- */
export function Histogram({ values, bins = 26, height = 78, color = "var(--sky-line)", cuts = [] }: {
  values: number[]; bins?: number; height?: number; color?: string;
  cuts?: { at: number; color: string; label?: string }[];
}) {
  const lo = 0, hi = 1;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const k = Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)));
    counts[k]++;
  }
  const max = Math.max(...counts, 1);
  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" height={height} viewBox={`0 0 ${bins * 4} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {counts.map((c, i) => (
          <rect key={i} x={i * 4 + 0.35} width={3.3} y={height - (c / max) * height}
                height={(c / max) * height} fill={color} rx={0.8} />
        ))}
        {cuts.map((c, i) => (
          <line key={i} x1={c.at * bins * 4} x2={c.at * bins * 4} y1={0} y2={height}
                stroke={c.color} strokeWidth={1.2} strokeDasharray="3 2.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  );
}
