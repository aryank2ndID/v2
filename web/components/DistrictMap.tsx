"use client";
/**
 * District hotspot map.
 *
 * An equirectangular projection of the eight North-Eastern states with one
 * bubble per district: area is screening volume, fill is referral rate. There
 * is deliberately no state outline — a hand-traced boundary would be wrong at
 * exactly the places a district officer would notice, and a bubble map answers
 * "where should the next camp go" without pretending to be a survey map.
 */
import * as React from "react";
import type { District } from "@/lib/store";

export interface MapDatum { district: District; n: number; referRate: number; refers: number; }

const LON = [87.9, 96.4] as const;
const LAT = [22.3, 28.6] as const;

const STATE_TINT: Record<string, string> = {
  "Assam": "var(--sky-line)",
  "Meghalaya": "var(--sage-line)",
  "Arunachal Pradesh": "var(--lilac-line)",
  "Nagaland": "var(--amber-line)",
  "Manipur": "var(--blush-line)",
  "Mizoram": "var(--clay-line)",
  "Tripura": "var(--sky-line)",
  "Sikkim": "var(--lilac-line)",
};

function rampColor(rate: number, lo: number, hi: number) {
  const t = Math.max(0, Math.min(1, (rate - lo) / Math.max(1e-6, hi - lo)));
  // sage -> amber -> clay, kept muted so a dense map does not shout
  const stops: [number, number, number][] = [[191, 220, 162], [237, 207, 151], [222, 150, 118]];
  const i = t < 0.5 ? 0 : 1;
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * u));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function DistrictMap({ data, height = 430, onSelect, selected }: {
  data: MapDatum[]; height?: number;
  onSelect?: (id: string | null) => void; selected?: string | null;
}) {
  const [hover, setHover] = React.useState<string | null>(null);
  const [w, setW] = React.useState(680);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const pad = 26;
  const X = (lon: number) => pad + ((lon - LON[0]) / (LON[1] - LON[0])) * (w - pad * 2);
  const Y = (lat: number) => pad + ((LAT[1] - lat) / (LAT[1] - LAT[0])) * (height - pad * 2);

  const maxN = Math.max(...data.map((d) => d.n), 1);
  const rates = data.map((d) => d.referRate).sort((a, b) => a - b);
  const loRate = rates[0] ?? 0;
  const hiRate = rates[rates.length - 1] ?? 1;
  const R = (n: number) => 6 + Math.sqrt(n / maxN) * 20;

  const active = data.find((d) => d.district.id === (hover ?? selected));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <svg width="100%" height={height} style={{ display: "block", borderRadius: "var(--r)" }}>
        <rect x="0" y="0" width={w} height={height} fill="var(--surface-2)" rx="12" />
        {/* graticule at whole degrees, labelled — this is a map, not a decoration */}
        {Array.from({ length: 9 }, (_, i) => 88 + i).map((lon) => (
          <g key={`v${lon}`}>
            <line x1={X(lon)} x2={X(lon)} y1={pad - 12} y2={height - pad + 12}
                  stroke="var(--line)" strokeWidth={1} />
            <text x={X(lon)} y={height - 7} fontSize={9} fill="var(--ink-4)" textAnchor="middle">{lon}°E</text>
          </g>
        ))}
        {Array.from({ length: 7 }, (_, i) => 23 + i).map((lat) => (
          <g key={`h${lat}`}>
            <line x1={pad - 12} x2={w - pad + 12} y1={Y(lat)} y2={Y(lat)}
                  stroke="var(--line)" strokeWidth={1} />
            <text x={6} y={Y(lat) + 3} fontSize={9} fill="var(--ink-4)">{lat}°N</text>
          </g>
        ))}

        {data.map((d) => {
          const on = (hover ?? selected) === d.district.id;
          return (
            <g key={d.district.id}
               onMouseEnter={() => setHover(d.district.id)}
               onMouseLeave={() => setHover(null)}
               onClick={() => onSelect?.(selected === d.district.id ? null : d.district.id)}
               style={{ cursor: onSelect ? "pointer" : "default" }}>
              <circle cx={X(d.district.lon)} cy={Y(d.district.lat)} r={R(d.n) + (on ? 4 : 0)}
                      fill={rampColor(d.referRate, loRate, hiRate)}
                      stroke={on ? "var(--ink)" : STATE_TINT[d.district.state] ?? "var(--line-strong)"}
                      strokeWidth={on ? 1.8 : 1.1}
                      opacity={selected && selected !== d.district.id ? 0.35 : 0.9}
                      style={{ transition: "r .18s var(--ease), opacity .18s var(--ease)" }} />
              {(on || d.n > maxN * 0.55) && (
                <text x={X(d.district.lon)} y={Y(d.district.lat) - R(d.n) - 6}
                      fontSize={10.5} fill="var(--ink-2)" textAnchor="middle"
                      style={{ fontWeight: 560, pointerEvents: "none" }}>
                  {d.district.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="row wrap" style={{ gap: 18, marginTop: 10, paddingLeft: 4 }}>
        <div className="row" style={{ gap: 7 }}>
          <span className="tiny dim">Referral rate</span>
          <span style={{
            width: 74, height: 8, borderRadius: 99,
            background: `linear-gradient(90deg, ${rampColor(loRate, loRate, hiRate)}, ${rampColor((loRate + hiRate) / 2, loRate, hiRate)}, ${rampColor(hiRate, loRate, hiRate)})`,
            border: "1px solid var(--line)",
          }} />
          <span className="tiny faint num">{(loRate * 100).toFixed(0)}%–{(hiRate * 100).toFixed(0)}%</span>
        </div>
        <div className="row" style={{ gap: 7 }}>
          <span className="tiny dim">Bubble area</span>
          <svg width="46" height="16">
            <circle cx="7" cy="8" r="4" fill="none" stroke="var(--ink-4)" />
            <circle cx="24" cy="8" r="6.5" fill="none" stroke="var(--ink-4)" />
            <circle cx="41" cy="8" r="8" fill="none" stroke="var(--ink-4)" />
          </svg>
          <span className="tiny faint">screenings</span>
        </div>
      </div>

      {active && (
        <div style={{
          position: "absolute", right: 12, top: 12, width: 208,
          background: "var(--surface)", border: "1px solid var(--line)",
          borderRadius: "var(--r-sm)", padding: "10px 12px", boxShadow: "var(--sh-3)",
          pointerEvents: "none",
        }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{active.district.name}</div>
          <div className="tiny dim">{active.district.state}</div>
          <div style={{ marginTop: 8 }}>
            <div className="kv"><dt>Screened</dt><dd>{active.n}</dd></div>
            <div className="kv"><dt>Referred</dt><dd>{active.refers} · {(active.referRate * 100).toFixed(0)}%</dd></div>
            <div className="kv"><dt>Terrain index</dt><dd>{active.district.terrain.toFixed(2)}</dd></div>
            <div className="kv"><dt>PHCs</dt><dd>{active.district.phc}</dd></div>
          </div>
        </div>
      )}
    </div>
  );
}
