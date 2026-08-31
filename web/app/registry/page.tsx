"use client";
import * as React from "react";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, SimBadge, PageHead, Skeleton } from "@/components/ui";
import { IcFilter, IcClose, IcCheck, IcSync, IcChevron, IcUser } from "@/components/Icons";
import {
  useSandhi, pct, int, num, formatFeature, BAND_LABEL, BAND_CHIP, BAND_VAR,
  FEATURE_LABEL, FEATURE_UNIT, CHANNEL_LABEL, CHANNEL_CHIP, type CohortRecord,
} from "@/lib/store";
import { FEATURE_CHANNEL, FEATURE_NAMES } from "@/lib/dsp/features";
import { explain, predict } from "@/lib/model/runtime";

type SortKey = "risk" | "age" | "days_ago" | "name" | "womac_pain";
const PAGE = 25;

export default function Registry() {
  const { cohort, model, metrics, outbox } = useSandhi();
  const [q, setQ] = React.useState("");
  const [band, setBand] = React.useState("all");
  const [state, setState] = React.useState("all");
  const [sync, setSync] = React.useState("all");
  const [sort, setSort] = React.useState<SortKey>("risk");
  const [asc, setAsc] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [open, setOpen] = React.useState<CohortRecord | null>(null);

  const states = React.useMemo(
    () => (cohort ? Array.from(new Set(cohort.records.map((r) => r.state))).sort() : []),
    [cohort]
  );

  const rows = React.useMemo(() => {
    if (!cohort) return [];
    const needle = q.trim().toLowerCase();
    let r = cohort.records.filter((x) => {
      if (band !== "all" && x.band !== band) return false;
      if (state !== "all" && x.state !== state) return false;
      if (sync === "synced" && !x.synced) return false;
      if (sync === "pending" && x.synced) return false;
      if (needle && !(x.name.toLowerCase().includes(needle) || x.id.toLowerCase().includes(needle)
        || x.occupation.toLowerCase().includes(needle))) return false;
      return true;
    });
    const dir = asc ? 1 : -1;
    r = [...r].sort((a, b) => {
      const va = sort === "name" ? a.name : (a[sort] as number);
      const vb = sort === "name" ? b.name : (b[sort] as number);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
    return r;
  }, [cohort, q, band, state, sync, sort, asc]);

  React.useEffect(() => setPage(0), [q, band, state, sync, sort, asc]);

  if (!cohort || !model) {
    return (<><TopBar title="Registry" /><div className="page"><Skeleton h={320} /></div></>);
  }

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.ceil(rows.length / PAGE);
  const pendingLocal = outbox.filter((o) => o.state !== "sent").length;

  const th = (k: SortKey, label: string, right?: boolean) => (
    <th className={right ? "rt" : ""} style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(false); } }}>
      <span className="row" style={{ gap: 3, justifyContent: right ? "flex-end" : "flex-start" }}>
        {label}
        {sort === k && (
          <svg width="8" height="8" viewBox="0 0 8 8" style={{ transform: asc ? "rotate(180deg)" : "none" }}>
            <path d="M4 6L1 2h6z" fill="currentColor" />
          </svg>
        )}
      </span>
    </th>
  );

  return (
    <>
      <TopBar title="Registry" right={<Chip>{int(rows.length)} of {int(cohort.records.length)}</Chip>} />
      <div className="page page-wide">
        <PageHead
          eyebrow="Layer 3 — patient registry"
          title="Screening registry"
          lead="Every screening that has reached the server, with the exact inputs and the exact attribution behind each score. A district officer must be able to answer 'why was this person referred' without calling anybody."
        />

        <SimBadge
          what="Synthetic people."
          why={`${int(cohort.records.length)} generated records. Names and villages are fabricated; risk scores are genuine model output on genuine feature vectors. ${pendingLocal > 0 ? `You also have ${pendingLocal} real screening(s) from this session waiting in the local outbox.` : ""}`}
        />

        <Card style={{ marginTop: 16 }}>
          <div className="card-hd" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="row grow" style={{ gap: 9, minWidth: 260 }}>
              <IcFilter size={14} style={{ color: "var(--ink-3)", flex: "0 0 14px" }} />
              <input className="input" placeholder="Search name, ID or occupation…"
                     value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 300 }} />
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              <select className="select" style={{ width: 132 }} value={band} onChange={(e) => setBand(e.target.value)}>
                <option value="all">All bands</option>
                <option value="low">Low</option><option value="watch">Watch</option><option value="refer">Refer</option>
              </select>
              <select className="select" style={{ width: 172 }} value={state} onChange={(e) => setState(e.target.value)}>
                <option value="all">All states</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="select" style={{ width: 134 }} value={sync} onChange={(e) => setSync(e.target.value)}>
                <option value="all">Any sync state</option>
                <option value="synced">Synced</option><option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tbl tbl-click">
              <thead>
                <tr>
                  <th style={{ width: 92 }}>ID</th>
                  {th("name", "Name")}
                  <th>District</th>
                  {th("age", "Age", true)}
                  <th className="rt">Sex</th>
                  <th className="rt">BMI</th>
                  <th>Work</th>
                  {th("womac_pain", "Pain", true)}
                  {th("risk", "Risk", true)}
                  <th>Band</th>
                  {th("days_ago", "Screened", true)}
                  <th>Sync</th>
                  <th style={{ width: 26 }} />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const d = cohort.districts.find((x) => x.id === r.district);
                  return (
                    <tr key={r.id} onClick={() => setOpen(r)}>
                      <td className="mono dim">{r.id}</td>
                      <td style={{ fontWeight: 540, whiteSpace: "nowrap" }}>{r.name}</td>
                      <td className="dim" style={{ whiteSpace: "nowrap" }}>{d?.name ?? r.district}</td>
                      <td className="rt num">{r.age.toFixed(0)}</td>
                      <td className="rt dim">{r.sex}</td>
                      <td className="rt num">{r.bmi.toFixed(1)}</td>
                      <td className="dim tiny" style={{ whiteSpace: "nowrap" }}>{r.occupation}</td>
                      <td className="rt num">{r.womac_pain.toFixed(0)}</td>
                      <td className="rt num" style={{ fontWeight: 600 }}>{pct(r.risk, 0)}</td>
                      <td><span className={`chip ${BAND_CHIP[r.band]}`}>{BAND_LABEL[r.band]}</span></td>
                      <td className="rt dim tiny" style={{ whiteSpace: "nowrap" }}>{r.days_ago}d ago</td>
                      <td>{r.synced
                        ? <IcCheck size={13} style={{ color: "var(--sage-ink)" }} />
                        : <IcSync size={13} style={{ color: "var(--amber-ink)" }} />}</td>
                      <td><IcChevron size={12} style={{ color: "var(--ink-4)" }} /></td>
                    </tr>
                  );
                })}
                {!pageRows.length && (
                  <tr><td colSpan={13} style={{ textAlign: "center", padding: 34, color: "var(--ink-3)" }}>
                    Nothing matches those filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card-ft between">
            <span>Showing {int(page * PAGE + 1)}–{int(Math.min(rows.length, (page + 1) * PAGE))} of {int(rows.length)}</span>
            <div className="row" style={{ gap: 7 }}>
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="num tiny" style={{ minWidth: 62, textAlign: "center" }}>{page + 1} / {Math.max(1, pages)}</span>
              <button className="btn btn-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </Card>
      </div>

      {open && <RecordDrawer record={open} onClose={() => setOpen(null)} model={model}
                             district={cohort.districts.find((d) => d.id === open.district)} />}
    </>
  );
}

function RecordDrawer({ record, onClose, model, district }: {
  record: CohortRecord; onClose: () => void; model: any; district?: { name: string; state: string; terrain: number; phc: number };
}) {
  const x = React.useMemo(() => FEATURE_NAMES.map((n) => record.features[n] ?? 0), [record]);
  const top = React.useMemo(() => explain(model, x, 8), [model, x]);
  const recomputed = React.useMemo(() => predict(model, x), [model, x]);

  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const groups: ["gait" | "sts" | "intake", string][] = [
    ["intake", "Intake form"], ["gait", "Gait IMU"], ["sts", "Sit-to-stand"]
  ];
  const maxAbs = Math.max(...top.map((e) => Math.abs(e.contribution)), 1e-6);

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(31,28,26,.24)",
        backdropFilter: "blur(2px)", zIndex: 90, animation: "fadeIn .2s",
      }} />
      <aside className="rise" style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 520, maxWidth: "94vw",
        background: "var(--paper)", borderLeft: "1px solid var(--line)",
        zIndex: 91, overflowY: "auto", boxShadow: "var(--sh-pop)",
      }}>
        <div className="between" style={{
          padding: "14px 20px", borderBottom: "1px solid var(--line)",
          position: "sticky", top: 0, background: "rgba(251,250,248,.9)",
          backdropFilter: "blur(12px)", zIndex: 2,
        }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center",
              background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--ink-3)",
            }}><IcUser size={15} /></span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{record.name}</div>
              <div className="tiny dim mono">{record.id}</div>
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><IcClose size={13} /></button>
        </div>

        <div style={{ padding: "18px 20px 44px" }} className="stack">
          <div style={{
            padding: "15px 16px", borderRadius: "var(--r)",
            background: record.band === "low" ? "var(--sage-bg)" : record.band === "watch" ? "var(--amber-bg)" : "var(--clay-bg)",
            border: `1px solid ${record.band === "low" ? "var(--sage-line)" : record.band === "watch" ? "var(--amber-line)" : "var(--clay-line)"}`,
          }}>
            <div className="between">
              <div>
                <div className="eyebrow" style={{ color: BAND_VAR[record.band], opacity: .8 }}>Result</div>
                <div className="serif" style={{ fontSize: 24, marginTop: 4, color: BAND_VAR[record.band] }}>
                  {BAND_LABEL[record.band]}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="serif num" style={{ fontSize: 28, color: BAND_VAR[record.band], lineHeight: 1 }}>
                  {pct(record.risk, 1)}
                </div>
                <div className="tiny" style={{ color: BAND_VAR[record.band], opacity: .7, marginTop: 3 }}>
                  re-scored on this page: {pct(recomputed, 1)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid g2" style={{ marginTop: 14, gap: 12 }}>
            <Card><div className="card-bd" style={{ padding: "12px 14px" }}>
              <div className="eyebrow" style={{ marginBottom: 7 }}>Person</div>
              <div className="kv"><dt>Age</dt><dd>{record.age.toFixed(0)}</dd></div>
              <div className="kv"><dt>Sex</dt><dd>{record.sex === "F" ? "Female" : "Male"}</dd></div>
              <div className="kv"><dt>BMI</dt><dd>{record.bmi.toFixed(1)}</dd></div>
              <div className="kv"><dt>Work</dt><dd style={{ fontSize: 12 }}>{record.occupation}</dd></div>
            </div></Card>
            <Card><div className="card-bd" style={{ padding: "12px 14px" }}>
              <div className="eyebrow" style={{ marginBottom: 7 }}>Place</div>
              <div className="kv"><dt>District</dt><dd style={{ fontSize: 12 }}>{district?.name ?? record.district}</dd></div>
              <div className="kv"><dt>State</dt><dd style={{ fontSize: 12 }}>{record.state}</dd></div>
              <div className="kv"><dt>Terrain</dt><dd>{district?.terrain.toFixed(2) ?? "—"}</dd></div>
              <div className="kv"><dt>Screened</dt><dd>{record.days_ago} d ago</dd></div>
            </div></Card>
          </div>

          <Card style={{ marginTop: 14 }}>
            <CardHead title="Why this score" sub="Exact path attribution, log-odds" />
            <div className="card-bd stack" style={{ gap: 7 }}>
              {top.map((e) => {
                const w = (Math.abs(e.contribution) / maxAbs) * 50;
                const up = e.contribution > 0;
                return (
                  <div key={e.feature} className="row" style={{ gap: 9, fontSize: 12.2 }}>
                    <span style={{ flex: "0 0 150px", textAlign: "right", color: "var(--ink-2)" }}>
                      {FEATURE_LABEL[e.feature]}
                    </span>
                    <span className="grow" style={{ position: "relative", height: 14 }}>
                      <span style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--line-strong)" }} />
                      <span style={{
                        position: "absolute", top: 2, height: 10, borderRadius: 3,
                        background: up ? "var(--clay-line)" : "var(--sage-line)",
                        left: up ? "50%" : `${50 - w}%`, width: `${w}%`,
                      }} />
                    </span>
                    <span className="num tiny" style={{ flex: "0 0 46px", color: "var(--ink-3)" }}>
                      {formatFeature(e.feature, e.value)}
                    </span>
                    <span className="num tiny" style={{
                      flex: "0 0 46px", fontWeight: 570,
                      color: up ? "var(--clay-ink)" : "var(--sage-ink)",
                    }}>{up ? "+" : ""}{e.contribution.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <CardHead title="All 30 model inputs" sub="Exactly what the booster saw" />
            <div className="card-bd stack" style={{ gap: 13 }}>
              {groups.map(([g, label]) => {
                const keys = FEATURE_NAMES.filter((n) => FEATURE_CHANNEL[n] === g);
                return (
                  <div key={g}>
                    <div className="row" style={{ gap: 7, marginBottom: 6 }}>
                      <Chip tone={CHANNEL_CHIP[g]}>{label}</Chip>
                      <span className="tiny faint">{keys.length} inputs</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 6 }}>
                      {keys.map((k) => (
                        <div key={k} style={{
                          padding: "5px 8px", borderRadius: "var(--r-xs)",
                          background: "var(--surface-2)", border: "1px solid var(--line-soft)",
                        }}>
                          <div className="tiny dim" style={{ lineHeight: 1.2 }}>{FEATURE_LABEL[k]}</div>
                          <div className="num" style={{ fontWeight: 560, fontSize: 12.6 }}>
                            {formatFeature(k, record.features[k])}{" "}
                            <span className="tiny faint" style={{ fontWeight: 400 }}>{FEATURE_UNIT[k]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card-ft">
              Simulator ground truth for this synthetic subject: KL grade {record.kl_truth}.
              This is the label the model was trained to predict (KL ≥ 2) and is never shown in
              the field build — it does not exist for a real patient.
            </div>
          </Card>
        </div>
      </aside>
    </>
  );
}
