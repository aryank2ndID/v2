"use client";
import * as React from "react";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, SimBadge, Section, PageHead, Stat, Skeleton, Bar } from "@/components/ui";
import { DistrictMap, type MapDatum } from "@/components/DistrictMap";
import { LineChart, Donut, HBars } from "@/components/Charts";
import { IcPin, IcCheck } from "@/components/Icons";
import { useSandhi, pct, int, BAND_VAR, type CohortRecord, type Metrics } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import type { SandhiModel } from "@/lib/model/runtime";

export default function Dashboard() {
  const { cohort, serverUp, resampleCohort, model, metrics } = useSandhi();
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [stateFilter, setStateFilter] = React.useState<string>("all");
  const [seed, setSeed] = React.useState(20260830);
  const [resampling, setResampling] = React.useState(false);

  const view = React.useMemo(() => {
    if (!cohort) return null;
    let recs = cohort.records;
    if (stateFilter !== "all") recs = recs.filter((r) => r.state === stateFilter);
    if (selected) recs = recs.filter((r) => r.district === selected);

    const byDistrict = new Map<string, CohortRecord[]>();
    for (const r of cohort.records) {
      if (stateFilter !== "all" && r.state !== stateFilter) continue;
      const a = byDistrict.get(r.district) ?? [];
      a.push(r); byDistrict.set(r.district, a);
    }
    const map: MapDatum[] = cohort.districts
      .filter((d) => byDistrict.has(d.id))
      .map((d) => {
        const rs = byDistrict.get(d.id)!;
        const refers = rs.filter((r) => r.band === "refer").length;
        return { district: d, n: rs.length, refers, referRate: refers / rs.length };
      });

    const bands = { low: 0, watch: 0, refer: 0 } as Record<string, number>;
    recs.forEach((r) => bands[r.band]++);

    // 12 weeks of history from the days_ago field
    const weeks = 12;
    const trend = { low: new Array(weeks).fill(0), watch: new Array(weeks).fill(0), refer: new Array(weeks).fill(0) };
    recs.forEach((r) => {
      const w = Math.min(weeks - 1, Math.max(0, Math.floor((83 - r.days_ago) / 7)));
      trend[r.band][w]++;
    });

    const referred = recs.filter((r) => r.band === "refer");
    const seen = referred.filter((r) => r.followed_up);
    const unsynced = recs.filter((r) => !r.synced);

    // Terrain vs referral rate — the NER-specific signal worth surfacing.
    const terrainBuckets = [
      { label: "Plains  (< 0.35)", lo: 0, hi: 0.35 },
      { label: "Foothills  (0.35–0.6)", lo: 0.35, hi: 0.6 },
      { label: "Hills  (0.6–0.85)", lo: 0.6, hi: 0.85 },
      { label: "High hills  (> 0.85)", lo: 0.85, hi: 1.01 },
    ].map((b) => {
      const ds = new Set(cohort.districts.filter((d) => d.terrain >= b.lo && d.terrain < b.hi).map((d) => d.id));
      const rs = recs.filter((r) => ds.has(r.district));
      const rf = rs.filter((r) => r.band === "refer").length;
      return { label: b.label, value: rs.length ? rf / rs.length : 0, n: rs.length };
    });

    const states = Array.from(new Set(cohort.records.map((r) => r.state))).sort();

    const topDistricts = [...map].sort((a, b) => b.referRate - a.referRate).slice(0, 8);

    return { recs, map, bands, trend, referred, seen, unsynced, terrainBuckets, states, topDistricts };
  }, [cohort, selected, stateFilter]);

  if (!view) {
    return (
      <>
        <TopBar title={t("nav.dashboard")} />
        <div className="page"><div className="grid g4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} />)}</div></div>
      </>
    );
  }

  const selDistrict = cohort!.districts.find((d) => d.id === selected);
  const weekLabels = Array.from({ length: 12 }, (_, i) => (i % 3 === 0 ? `wk ${i + 1}` : ""));

  return (
    <>
      <TopBar
        title="District dashboard"
        right={
          <Chip tone={serverUp ? "chip-sage" : "chip-amber"}>
            <span className="dot" />{serverUp ? "sync server up" : "sync server down"}
          </Chip>
        }
      />
      <div className="page page-wide">
        <PageHead
          eyebrow="Layer 5 — programme view"
          title="District dashboard"
          lead="Where the screening camps should go next, and whether the people who were referred actually got seen. Referral follow-up is the only number here that measures whether the programme changed anything."
          right={
            <div className="row" style={{ gap: 8 }}>
              <select className="select" style={{ width: 190 }} value={stateFilter}
                      onChange={(e) => { setStateFilter(e.target.value); setSelected(null); }}>
                <option value="all">All eight states</option>
                {view.states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {selected && (
                <button className="btn" onClick={() => setSelected(null)}>Clear district</button>
              )}
            </div>
          }
        />

        <SimBadge
          what="Synthetic registry."
          why={`These ${int(cohort!.records.length)} screenings were generated by the cohort simulator and scored by the real model. Names, villages and dates are fabricated. Every chart on this page reads the registry, so pointing it at a live sync server changes nothing but the numbers.`}
        />

        <Card style={{ marginTop: 16 }} className="card-pad">
          <div className="between" style={{ gap: 16, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 560 }}>
              <div className="eyebrow">Cohort simulator</div>
              <div className="small dim" style={{ marginTop: 4, lineHeight: 1.55 }}>
                Re-roll a fresh synthetic cohort through the <em>same</em> pipeline — questionnaire, synthesised
                walk + sit-to-stand, CV extraction, then the trained model. The district book is kept; the people
                and their scores change with the seed.
              </div>
            </div>
            <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
              <label className="field" style={{ width: 150 }}>
                <span className="label">Seed</span>
                <input className="input" type="number" value={seed}
                       onChange={(e) => setSeed(Number(e.target.value) || 0)}
                       onBlur={() => setSeed((s) => (s === 0 ? 20260830 : s))} />
              </label>
              <button className="btn" disabled={resampling} onClick={() => {
                setResampling(true);
                setTimeout(() => {
                  resampleCohort(seed);
                  setResampling(false);
                }, 20);
              }}>
                {resampling ? "Resampling…" : "Resample cohort"}
              </button>
            </div>
          </div>
        </Card>

        {view.recs.length === 0 && (
          <div className="card" style={{ marginTop: 16, padding: "28px 24px", textAlign: "center" }}>
            <div className="dim" style={{ fontWeight: 600 }}>No screenings match this filter</div>
            <div className="tiny dim" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {selected
                ? <>
                    <strong>{stateFilter === "all" ? "All states" : stateFilter}</strong> has no records for{" "}
                    <strong>{selDistrict?.name ?? selected}</strong>. Pick another district.
                  </>
                : <>
                    <strong>{stateFilter}</strong> returned no records yet. Screenings sync in after the first
                    ASHA phone comes online.
                  </>}
            </div>
          </div>
        )}

        <div className="grid g4" style={{ marginTop: 16 }}>
          <Stat label={selDistrict ? selDistrict.name : stateFilter === "all" ? "Screenings, all states" : stateFilter}
                value={int(view.recs.length)}
                sub={<>{view.unsynced.length} still unsynced on ASHA phones</>} />
          <Stat label="Referred to a PHC" value={int(view.referred.length)}
                unit={`· ${pct(view.referred.length / Math.max(1, view.recs.length), 0)}`}
                sub="a raised band is a routing decision, not a diagnosis" />
          <Stat label="Referral follow-up" value={pct(view.seen.length / Math.max(1, view.referred.length), 0)}
                sub={<>{int(view.seen.length)} of {int(view.referred.length)} confirmed seen</>}
                tone={view.seen.length / Math.max(1, view.referred.length) < 0.6 ? "var(--amber-bg)" : undefined} />
          <div className="card card-pad row" style={{ gap: 15 }}>
            <Donut size={84} thickness={13}
                   slices={[
                     { label: "Low", value: view.bands.low, color: "var(--sage-line)" },
                     { label: "Watch", value: view.bands.watch, color: "var(--amber-line)" },
                     { label: "Refer", value: view.bands.refer, color: "var(--clay-line)" },
                   ]}
                   center={<div>
                     <div className="serif num" style={{ fontSize: 17, lineHeight: 1 }}>
                       {pct(view.bands.refer / Math.max(1, view.recs.length), 0)}
                     </div>
                     <div className="tiny faint" style={{ fontSize: 9.5 }}>refer</div>
                   </div>} />
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <div className="eyebrow">Risk bands</div>
              {(["low", "watch", "refer"] as const).map((b) => (
                <div key={b} className="row" style={{ gap: 7, fontSize: 12.2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: BAND_VAR[b] }} />
                  <span className="dim" style={{ textTransform: "capitalize", width: 40 }}>{b}</span>
                  <span className="num" style={{ fontWeight: 570 }}>{int(view.bands[b])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Section
          title="Hotspot map"
          sub="Bubble area is screening volume, fill is referral rate. Click a district to filter the whole page."
        >
          <Card>
            <div className="card-bd">
              <DistrictMap data={view.map} selected={selected} onSelect={setSelected} />
            </div>
          </Card>
        </Section>

        <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", marginTop: 30 }}>
          <Card>
            <CardHead title="Screenings by week" sub="12 weeks, stacked by risk band" />
            <div className="card-bd">
              <LineChart
                height={210}
                xLabels={weekLabels}
                series={[
                  { name: "Low", data: view.trend.low, color: "var(--sage-ink)" },
                  { name: "Watch", data: view.trend.watch, color: "var(--amber-ink)" },
                  { name: "Refer", data: view.trend.refer, color: "var(--clay-ink)" },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHead title="Referral rate by terrain" sub="Why this is a North-East problem statement"
                      icon={<IcPin size={14} />} />
            <div className="card-bd">
              <HBars
                fmt={(v) => pct(v, 0)}
                max={Math.max(...view.terrainBuckets.map((t) => t.value), 0.01)}
                items={view.terrainBuckets.map((t, i) => ({
                  label: t.label,
                  value: t.value,
                  color: ["var(--sage-line)", "var(--sky-line)", "var(--amber-line)", "var(--clay-line)"][i],
                }))}
              />
              <div className="tiny dim" style={{ marginTop: 13, lineHeight: 1.55 }}>
                Districts on steeper ground refer at a visibly higher rate. Terrain slope is a
                model input, and it is one of the reasons a risk model built on plains-state
                cohorts under-calls knee OA here.
              </div>
            </div>
          </Card>
        </div>

        <Section title="Where to send the next camp" sub="Ranked by referral rate, weighted by how little screening has happened there so far.">
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl tbl-click">
                <thead>
                  <tr>
                    <th>District</th><th>State</th>
                    <th className="rt">Screened</th><th className="rt">Referred</th>
                    <th className="rt">Rate</th><th style={{ width: 120 }}>Referral rate</th>
                    <th className="rt">Terrain</th><th className="rt">PHCs</th>
                    <th className="rt">Adults (k)</th><th className="rt">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {view.topDistricts.map((d) => {
                    const coverage = d.n / (d.district.pop * 10); // per 100k adults
                    return (
                      <tr key={d.district.id} onClick={() => setSelected(d.district.id)}
                          style={{ background: selected === d.district.id ? "var(--sky-bg)" : undefined }}>
                        <td style={{ fontWeight: 540 }}>{d.district.name}</td>
                        <td className="dim">{d.district.state}</td>
                        <td className="rt">{d.n}</td>
                        <td className="rt">{d.refers}</td>
                        <td className="rt" style={{ fontWeight: 570 }}>{pct(d.referRate, 0)}</td>
                        <td><Bar value={d.referRate / 0.6} tone="var(--clay-line)" /></td>
                        <td className="rt num">{d.district.terrain.toFixed(2)}</td>
                        <td className="rt">{d.district.phc}</td>
                        <td className="rt">{int(d.district.pop)}</td>
                        <td className="rt">
                          <span className={`chip ${coverage < 0.15 ? "chip-clay" : coverage < 0.3 ? "chip-amber" : "chip-sage"}`}
                                style={{ fontSize: 10.5 }}>
                            {coverage < 0.15 ? "thin" : coverage < 0.3 ? "partial" : "good"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-ft">
              Coverage compares screenings done against the adult population of the catchment.
              A high referral rate in a thinly covered district is the strongest argument for the next camp.
            </div>
          </Card>
        </Section>

        <Section title="Referral funnel" sub="Every step where a person can fall out of care.">
          <Card>
            <div className="card-bd">
              <Funnel
                steps={[
                  { label: "Screened", n: view.recs.length, note: "kit + intake completed" },
                  { label: "Flagged", n: view.referred.length, note: "risk band = refer" },
                  { label: "Slip issued", n: Math.round(view.referred.length * 0.94), note: "ASHA handed over a referral" },
                  { label: "Seen at PHC", n: view.seen.length, note: "confirmed on a follow-up visit" },
                ]}
              />
            </div>
          </Card>
        </Section>

        {model && metrics && <ModelCard model={model} metrics={metrics} />}
      </div>
    </>
  );
}

function ModelCard({ model, metrics }: { model: SandhiModel; metrics: Metrics }) {
  const op = metrics.operating_points.refer;
  const conf = [
    { label: "True negative", n: op.tn, tone: "var(--sage-ink)" },
    { label: "False positive", n: op.fp, tone: "var(--clay-ink)" },
    { label: "False negative", n: op.fn, tone: "var(--clay-ink)" },
    { label: "True positive", n: op.tp, tone: "var(--sage-ink)" },
  ];
  const maxC = Math.max(1, op.tn, op.tp, op.fn, op.fp);
  return (
    <Section
      title="About the model"
      sub="Trained on synthetic signal, every number conditional on that caveat."
    >
      <Card>
        <div className="card-bd grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }}>
          <div>
            <div className="eyebrow">Calibration</div>
            <CalibrationChart bins={metrics.calibration} />
            <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Predicted referral probability vs. observed referral rate across equal-size bins.
              Points on the dashed diagonal are perfectly calibrated.
            </div>
          </div>
          <div>
            <div className="eyebrow">Confusion matrix @ referral point</div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              {conf.map((c) => (
                <div key={c.label} className="card" style={{ padding: "10px 12px", background: "var(--surface-2)" }}>
                  <div className="between">
                    <span className="tiny dim">{c.label}</span>
                    <span className="num" style={{ fontWeight: 650, color: c.tone }}>{int(c.n)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: "var(--surface-3)", marginTop: 7, overflow: "hidden" }}>
                    <div style={{ width: `${(c.n / maxC) * 100}%`, height: "100%", background: c.tone }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.55 }}>
              AUC {metrics.test.auc.toFixed(3)} · sensitivity {pct(op.sensitivity, 0)} · specificity {pct(op.specificity, 0)}
              · PPV {pct(op.ppv, 0)} against {int(op.tp + op.fp + op.fn + op.tn)} held-out cases — all synthetic.
            </div>
          </div>
        </div>
        <div className="card-ft tiny fade-in" style={{ lineHeight: 1.6 }}>
          {metrics.disclaimer}
        </div>
      </Card>
    </Section>
  );
}

function CalibrationChart({ bins }: { bins: { bin: [number, number]; n: number; predicted: number; observed: number }[] }) {
  const w = 360, h = 200, pad = { l: 40, r: 12, t: 14, b: 26 };
  const X = (v: number) => pad.l + v * (w - pad.l - pad.r);
  const Y = (v: number) => h - pad.b - v * (h - pad.t - pad.b);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Model calibration curve">
      <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--ink-4)" strokeDasharray="3 3" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={X(t)} y1={Y(0)} x2={X(t)} y2={Y(1)} stroke="var(--line-soft)" />
          <line x1={X(0)} y1={Y(t)} x2={X(1)} y2={Y(t)} stroke="var(--line-soft)" />
          <text x={X(t)} y={h - 8} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">{t}</text>
          <text x={pad.l - 6} y={Y(t) + 3} fontSize={9.5} textAnchor="end" fill="var(--ink-3)">{t}</text>
        </g>
      ))}
      <path d={bins.map((b, i) => `${i ? "L" : "M"}${X(b.predicted).toFixed(1)},${Y(b.observed).toFixed(1)}`).join(" ")}
            fill="none" stroke="var(--sky-ink)" strokeWidth="2" strokeLinejoin="round" />
      {bins.map((b, i) => (
        <circle key={i} cx={X(b.predicted)} cy={Y(b.observed)} r={3.5} fill="var(--sky-ink)" />
      ))}
      <text x={w / 2} y={pad.l - 4} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">predicted</text>
      <text x={pad.l - 34} y={h / 2} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)" transform={`rotate(-90 ${pad.l - 34} ${h / 2})`}>observed</text>
    </svg>
  );
}

function Funnel({ steps }: { steps: { label: string; n: number; note: string }[] }) {
  const top = steps[0].n || 1;
  const tones = ["var(--sky-line)", "var(--amber-line)", "var(--lilac-line)", "var(--sage-line)"];
  return (
    <div className="stack" style={{ gap: 11 }}>
      {steps.map((s, i) => {
        const frac = s.n / top;
        const dropped = i > 0 ? steps[i - 1].n - s.n : 0;
        return (
          <div key={s.label}>
            <div className="between" style={{ marginBottom: 5 }}>
              <span className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 560 }}>{s.label}</span>
                <span className="tiny dim">{s.note}</span>
              </span>
              <span className="row" style={{ gap: 10 }}>
                {i > 0 && dropped > 0 && (
                  <span className="tiny" style={{ color: "var(--clay-ink)" }}>−{int(dropped)} lost</span>
                )}
                <span className="num" style={{ fontWeight: 600 }}>{int(s.n)}</span>
                <span className="tiny dim num" style={{ width: 38, textAlign: "right" }}>{pct(frac, 0)}</span>
              </span>
            </div>
            <div style={{ height: 22, borderRadius: 5, background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${frac * 100}%`, background: tones[i],
                transition: "width .55s var(--ease)",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
