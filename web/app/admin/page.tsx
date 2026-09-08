"use client";
/**
 * The programme office console.
 *
 * Deliberately the opposite of /volunteer: no individual's name, no exercise
 * plan, no advice. An admin's questions are "who is free", "which villages are
 * short-staffed", and "where has the district not been reached" — so those are
 * the only three things on the page.
 *
 * USPs delivered here: 5 (health workers treated as assignable agents with a
 * camp board) and 7 (district census and coverage).
 */
import * as React from "react";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, Empty, Skeleton } from "@/components/ui";
import { HBars } from "@/components/Charts";
import { MakeInIndia } from "@/components/Brand";
import { Tabs, TabPanel, Choice } from "@/components/Segmented";
import { useSandhi, int, pct, BAND_VAR } from "@/lib/store";
import { useAuth, initials } from "@/lib/auth";
import {
  buildRoster, buildCamps, suggestFor, loadAssignments, saveAssignments,
  STATUS_LABEL, STATUS_CHIP, type Worker, type Camp, type Assignments,
} from "@/lib/data/workers";
import {
  IcUsers, IcMap, IcPin, IcCalendar, IcSearch, IcCheck, IcClose, IcAlert,
  IcKit, IcPhone, IcTarget, IcSpark,
} from "@/components/Icons";

type Tab = "camps" | "workers" | "census";

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { id: "camps",   label: "Camp assignment", Icon: IcCalendar },
  { id: "workers", label: "Health workers",  Icon: IcUsers },
  { id: "census",  label: "District census", Icon: IcMap },
];

export default function AdminConsole() {
  const { cohort, ready } = useSandhi();
  const { session } = useAuth();
  const [tab, setTab] = React.useState<Tab>("camps");

  const districts = cohort?.districts ?? [];
  const roster = React.useMemo(() => buildRoster(districts), [districts]);
  const camps = React.useMemo(() => buildCamps(districts), [districts]);

  const [assignments, setAssignments] = React.useState<Assignments>({});
  React.useEffect(() => { setAssignments(loadAssignments()); }, []);
  const update = React.useCallback((next: Assignments) => {
    setAssignments(next);
    saveAssignments(next);
  }, []);

  if (!ready || !cohort) {
    return (
      <>
        <TopBar title="Admin console" />
        <div className="page"><div className="grid g4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} />)}</div></div>
      </>
    );
  }

  const available = roster.filter((w) => w.status === "available").length;
  const upcoming = camps.filter((c) => c.inDays >= 0);
  const understaffed = upcoming.filter((c) => (assignments[c.id]?.length ?? 0) < c.need).length;
  const screened = cohort.records.length;
  const adults = districts.reduce((s, d) => s + d.pop, 0) * 1000;

  return (
    <>
      <TopBar
        title="Admin console"
        right={<Chip tone="chip-lilac"><IcTarget size={11} />Programme</Chip>}
      />

      <div className="page page-wide">
        <header className="between enter" style={{ gap: 22, alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <h1 className="serif" style={{ fontSize: 27 }}>Programme office</h1>
            <div className="row wrap dim" style={{ gap: 7, marginTop: 5, fontSize: 12.6 }}>
              <span>{districts.length} districts · 8 states</span>
              <span>·</span>
              <span className="mono">{session?.workerId}</span>
            </div>
          </div>
          <MakeInIndia dark />
        </header>

        <div className="grid g4 enter-list" style={{ marginBottom: 22 }}>
          <Kpi i={0} icon={<IcUsers size={16} />} label="Workers free" value={available}
               sub={`of ${roster.length} on the roster`} tone="sage" />
          <Kpi i={1} icon={<IcCalendar size={16} />} label="Camps ahead" value={upcoming.length}
               sub="in the next four weeks" tone="sky" />
          <Kpi i={2} icon={<IcAlert size={16} />} label="Short-staffed" value={understaffed}
               sub="camps below the need" tone={understaffed ? "clay" : "sage"} />
          <Kpi i={3} icon={<IcMap size={16} />} label="Coverage" value={pct(screened / adults, 2)}
               sub={`${int(screened)} of ${int(adults)} adults`} tone="lilac" />
        </div>

        <div className="scroll-x" style={{ marginBottom: 20, paddingBottom: 2 }}>
          <Tabs items={TABS} value={tab} onChange={setTab} label="Programme sections" />
        </div>

        <TabPanel id={tab}>
          {tab === "camps" && (
            <CampBoard
              camps={camps} roster={roster} districts={districts}
              assignments={assignments} onChange={update}
            />
          )}
          {tab === "workers" && <RosterPanel roster={roster} districts={districts} assignments={assignments} />}
          {tab === "census" && <CensusPanel districts={districts} records={cohort.records} />}
        </TabPanel>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, sub, tone, i }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; tone: string; i: number;
}) {
  return (
    <div className="card card-pad lift" style={{ ["--i" as string]: i }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{
          width: 32, height: 32, flex: "0 0 32px", borderRadius: 11, display: "grid", placeItems: "center",
          background: `var(--${tone}-bg)`, color: `var(--${tone}-ink)`,
        }}>{icon}</span>
        <div className="eyebrow">{label}</div>
      </div>
      <div className="serif num" style={{ fontSize: 28, marginTop: 11, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
      <div className="tiny dim" style={{ marginTop: 6 }}>{sub}</div>
    </div>
  );
}

/* ------------------------------------------- USP 5: camps and assignment -- */

/** Sort key: future days ascending, then past days most-recent-first. */
const rank = (inDays: number) => (inDays >= 0 ? inDays : 1000 - inDays);

interface DistrictLike { id: string; name: string; state: string; terrain: number; phc: number; pop: number }

function CampBoard({ camps, roster, districts, assignments, onChange }: {
  camps: Camp[]; roster: Worker[]; districts: DistrictLike[];
  assignments: Assignments; onChange: (a: Assignments) => void;
}) {
  const [state, setState] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const dName = React.useMemo(
    () => Object.fromEntries(districts.map((d) => [d.id, d])) as Record<string, DistrictLike>,
    [districts],
  );

  const states = React.useMemo(
    () => Array.from(new Set(districts.map((d) => d.state))).sort(),
    [districts],
  );

  /* Upcoming first and soonest-first, then the last week's camps below —
     an admin is staffing the days ahead, not reading history. */
  const list = React.useMemo(() => camps
    .filter((c) => c.inDays >= -7)
    .filter((c) => state === "all" || dName[c.district]?.state === state)
    .sort((a, b) => rank(a.inDays) - rank(b.inDays))
    .slice(0, 24), [camps, state, dName]);

  const open = list.find((c) => c.id === openId) ?? null;

  const assign = (campId: string, workerId: string) => {
    const cur = assignments[campId] ?? [];
    onChange({ ...assignments, [campId]: [...cur, workerId] });
  };
  const unassign = (campId: string, workerId: string) => {
    const cur = assignments[campId] ?? [];
    onChange({ ...assignments, [campId]: cur.filter((w) => w !== workerId) });
  };

  return (
    <div className="split-board">
      <Card>
        <CardHead
          title="Camps"
          sub="Nearest first. A camp is ready when it has the workers it needs."
          icon={<IcCalendar size={15} />}
          right={
            <select className="select select-xs" value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
              <option value="all">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          }
        />
        <div className="card-bd">
          {list.length === 0 ? <Empty>No camps scheduled in {state}.</Empty> : (
            <div className="stack enter-list" style={{ gap: 10 }}>
              {list.map((c, i) => {
                const staffed = assignments[c.id]?.length ?? 0;
                const ready = staffed >= c.need;
                const past = c.inDays < 0;
                return (
                  <button
                    key={c.id} onClick={() => setOpenId(c.id)}
                    className="card card-quiet lift"
                    style={{
                      padding: "14px 16px", textAlign: "left", cursor: "pointer", width: "100%",
                      ["--i" as string]: i,
                      borderColor: openId === c.id ? "var(--accent)" : ready ? "var(--sage-line)" : "var(--line)",
                      opacity: past ? .6 : 1,
                    }}
                  >
                    <div className="between wrap" style={{ gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="row wrap" style={{ gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 650 }}>{c.village}</span>
                          <Chip style={{ fontSize: 10.4, padding: "2px 8px" }}>{dName[c.district]?.name ?? c.district}</Chip>
                          {past
                            ? <Chip style={{ fontSize: 10.4, padding: "2px 8px" }}>Done</Chip>
                            : <Chip tone={c.inDays <= 3 ? "chip-amber" : ""} style={{ fontSize: 10.4, padding: "2px 8px" }}>
                                {c.inDays === 0 ? "Today" : `in ${c.inDays} d`}
                              </Chip>}
                        </div>
                        <div className="row wrap dim" style={{ gap: 12, marginTop: 6, fontSize: 12.2 }}>
                          <span className="row" style={{ gap: 4 }}><IcUsers size={11} />{c.expected} expected</span>
                          <span className="row" style={{ gap: 4 }}><IcPin size={11} />{c.terrainNote}</span>
                        </div>
                      </div>

                      <div className="stack" style={{ gap: 5, minWidth: 118, flex: "0 0 auto" }}>
                        <div className="between">
                          <span className="tiny dim">Staffing</span>
                          <span className="tiny num" style={{ fontWeight: 640, color: ready ? "var(--sage-ink)" : "var(--amber-ink)" }}>
                            {staffed}/{c.need}
                          </span>
                        </div>
                        <div className="meter">
                          <span style={{
                            width: `${Math.min(1, staffed / c.need) * 100}%`,
                            background: ready ? "var(--sage-ink)" : "var(--amber-ink)",
                          }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* -------------------------------------------------- the assign panel */}
      {open
        ? <AssignPanel
            camp={open} roster={roster} district={dName[open.district]}
            assignments={assignments}
            onAssign={(w) => assign(open.id, w)}
            onUnassign={(w) => unassign(open.id, w)}
            onClose={() => setOpenId(null)}
          />
        : (
          <Card className="card-quiet">
            <div className="card-bd" style={{ textAlign: "center", padding: "44px 22px" }}>
              <span style={{
                width: 44, height: 44, borderRadius: 15, display: "inline-grid", placeItems: "center",
                background: "var(--accent-soft)", color: "var(--accent)", marginBottom: 14,
              }}><IcSpark size={20} /></span>
              <div style={{ fontSize: 14, fontWeight: 640 }}>Pick a camp</div>
              <p className="small dim" style={{ marginTop: 7, lineHeight: 1.55, maxWidth: 280, marginInline: "auto" }}>
                The workers who fit it best are ranked, with the reason shown.
              </p>
            </div>
          </Card>
        )}
    </div>
  );
}

function AssignPanel({ camp, roster, district, assignments, onAssign, onUnassign, onClose }: {
  camp: Camp; roster: Worker[]; district?: DistrictLike; assignments: Assignments;
  onAssign: (w: string) => void; onUnassign: (w: string) => void; onClose: () => void;
}) {
  const assigned = assignments[camp.id] ?? [];
  const byId = React.useMemo(() => Object.fromEntries(roster.map((w) => [w.id, w])), [roster]);
  const suggestions = React.useMemo(
    () => suggestFor(camp, roster, assignments).slice(0, 6),
    [camp, roster, assignments],
  );
  const ready = assigned.length >= camp.need;

  return (
    <Card className="enter sticky-side" style={{ position: "sticky", top: 84 }}>
      <CardHead
        title={camp.village}
        sub={`${district?.name ?? camp.district} · ${camp.expected} people expected`}
        icon={<IcPin size={15} />}
        right={
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
            <IcClose size={13} />
          </button>
        }
      />

      <div className="card-bd">
        <div className="row" style={{
          gap: 10, padding: "11px 13px", borderRadius: "var(--r-sm)", marginBottom: 16,
          background: ready ? "var(--sage-bg)" : "var(--amber-bg)",
          border: `1px solid ${ready ? "var(--sage-line)" : "var(--amber-line)"}`,
          color: ready ? "var(--sage-ink)" : "var(--amber-ink)",
        }}>
          {ready ? <IcCheck size={15} /> : <IcAlert size={15} />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {ready
              ? `Staffed — ${assigned.length} worker${assigned.length > 1 ? "s" : ""} assigned.`
              : `Needs ${camp.need - assigned.length} more worker${camp.need - assigned.length > 1 ? "s" : ""}.`}
          </span>
        </div>

        {assigned.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 9 }}>Assigned</div>
            <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
              {assigned.map((id) => {
                const w = byId[id];
                if (!w) return null;
                return (
                  <div key={id} className="row enter" style={{
                    gap: 10, padding: "9px 11px", borderRadius: "var(--r-sm)",
                    background: "var(--accent-soft)", border: "1px solid var(--accent)",
                  }}>
                    <span className="avatar">{initials(w.name)}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.2, fontWeight: 620 }}>{w.name}</div>
                      <div className="tiny dim mono">{w.id}</div>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => onUnassign(id)} aria-label={`Remove ${w.name}`}>
                      <IcClose size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="eyebrow" style={{ marginBottom: 9 }}>Best fit</div>
        {suggestions.length === 0 ? (
          <Empty>Everyone in this district is already assigned or on leave.</Empty>
        ) : (
          <div className="stack enter-list" style={{ gap: 8 }}>
            {suggestions.map((s, i) => (
              <div key={s.worker.id} className="row lift" style={{
                gap: 10, padding: "10px 11px", borderRadius: "var(--r-sm)",
                border: "1px solid var(--line)", background: "var(--surface-2)",
                ["--i" as string]: i,
              }}>
                <span className="avatar">{initials(s.worker.name)}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 7 }}>
                    <span style={{ fontSize: 13.2, fontWeight: 620 }}>{s.worker.name}</span>
                    {s.worker.hasKit && <IcKit size={12} style={{ color: "var(--sky-ink)" }} />}
                  </div>
                  {/* The reason matters more than the score — an assignment
                      an admin cannot explain is one they will not trust. */}
                  <div className="tiny dim" style={{ marginTop: 2 }}>{s.reason}</div>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => onAssign(s.worker.id)}>
                  Assign
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-ft">
        {camp.terrainNote} Assignments are held on this device and travel with the next sync.
      </div>
    </Card>
  );
}

/* ------------------------------------------------------ USP 5: the roster - */

function RosterPanel({ roster, districts, assignments }: {
  roster: Worker[]; districts: DistrictLike[]; assignments: Assignments;
}) {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | Worker["status"]>("all");

  const dName = React.useMemo(
    () => Object.fromEntries(districts.map((d) => [d.id, d.name])),
    [districts],
  );
  const busy = React.useMemo(
    () => new Set(Object.values(assignments).flat()),
    [assignments],
  );

  const list = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    return roster
      .filter((w) => status === "all" || w.status === status)
      .filter((w) => !t || w.name.toLowerCase().includes(t) || w.id.toLowerCase().includes(t) || (dName[w.district] ?? "").toLowerCase().includes(t))
      .slice(0, 80);
  }, [roster, q, status, dName]);

  return (
    <Card>
      <CardHead
        title="Health workers"
        sub={`${roster.length} on the roster across ${districts.length} districts`}
        icon={<IcUsers size={15} />}
        right={
          <div className="row wrap" style={{ gap: 9 }}>
            <label className="row" style={{
              gap: 7, padding: "0 11px", height: 32, borderRadius: 9,
              border: "1px solid var(--line-strong)", background: "var(--surface)",
            }}>
              <IcSearch size={13} />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} type="search"
                placeholder="Name, ID or district" aria-label="Search workers"
                style={{ border: 0, outline: "none", background: "transparent", fontSize: 12.6, width: 168, color: "inherit" }}
              />
            </label>
            <Choice
              label="Filter by availability"
              value={status}
              onChange={setStatus}
              items={[["all", "All"], ["available", "Free"], ["on-camp", "On camp"], ["leave", "Leave"]] as const}
            />
          </div>
        }
      />
      <div style={{ overflowX: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Worker</th><th>District</th><th>Village</th><th>Status</th>
              <th className="rt">Screenings / 30 d</th><th>Kit</th><th>Languages</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id}>
                <td>
                  <div className="row" style={{ gap: 9 }}>
                    <span className="avatar" style={{ width: 28, height: 28, flexBasis: 28, fontSize: 11 }}>{initials(w.name)}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{w.name}</div>
                      <div className="tiny dim mono">{w.id}</div>
                    </div>
                  </div>
                </td>
                <td className="dim">{dName[w.district] ?? w.district}</td>
                <td className="dim">{w.village}</td>
                <td>
                  <Chip tone={STATUS_CHIP[w.status]} style={{ fontSize: 10.6, padding: "2px 8px" }}>
                    {busy.has(w.id) ? "Assigned" : STATUS_LABEL[w.status]}
                  </Chip>
                </td>
                <td className="rt">
                  <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                    <span className="num" style={{ fontWeight: 620 }}>{w.recent}</span>
                    <div className="meter" style={{ width: 46, height: 6 }}>
                      <span style={{ width: `${Math.min(1, w.recent / 46) * 100}%`, background: w.recent > 30 ? "var(--amber-ink)" : "var(--accent)" }} />
                    </div>
                  </div>
                </td>
                <td>{w.hasKit ? <IcKit size={14} style={{ color: "var(--sky-ink)" }} /> : <span className="dim">shared</span>}</td>
                <td className="dim tiny">{w.languages.join(", ")}</td>
                <td className="rt">
                  <a className="btn btn-sm" href={`tel:${w.phone.replace(/\s/g, "")}`} title={w.phone}>
                    <IcPhone size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <Empty>Nobody matches that filter.</Empty>}
      </div>
      <div className="card-ft">
        Load is the balancing signal: a worker at 40 screenings in a month should get a lighter week, not another camp.
      </div>
    </Card>
  );
}

/* --------------------------------------------------- USP 7: district census */

type SortKey = "name" | "pop" | "screened" | "coverage" | "refer";

function CensusPanel({ districts, records }: {
  districts: DistrictLike[];
  records: { district: string; band: string; age: number; sex: string; followed_up: boolean }[];
}) {
  const [sort, setSort] = React.useState<SortKey>("coverage");
  const [state, setState] = React.useState("all");

  const rows = React.useMemo(() => {
    const byDistrict = new Map<string, { n: number; refer: number; watch: number; f: number; age: number }>();
    for (const r of records) {
      const cur = byDistrict.get(r.district) ?? { n: 0, refer: 0, watch: 0, f: 0, age: 0 };
      cur.n++;
      if (r.band === "refer") cur.refer++;
      if (r.band === "watch") cur.watch++;
      if (r.sex === "F") cur.f++;
      cur.age += r.age;
      byDistrict.set(r.district, cur);
    }
    return districts.map((d) => {
      const c = byDistrict.get(d.id) ?? { n: 0, refer: 0, watch: 0, f: 0, age: 0 };
      const adults = d.pop * 1000;
      return {
        ...d,
        adults,
        screened: c.n,
        coverage: c.n / adults,
        referRate: c.n ? c.refer / c.n : 0,
        watchRate: c.n ? c.watch / c.n : 0,
        femaleShare: c.n ? c.f / c.n : 0,
        meanAge: c.n ? c.age / c.n : 0,
      };
    });
  }, [districts, records]);

  const states = React.useMemo(() => Array.from(new Set(districts.map((d) => d.state))).sort(), [districts]);

  const view = React.useMemo(() => {
    const f = rows.filter((r) => state === "all" || r.state === state);
    const cmp: Record<SortKey, (a: typeof f[0], b: typeof f[0]) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      pop: (a, b) => b.adults - a.adults,
      screened: (a, b) => b.screened - a.screened,
      coverage: (a, b) => b.coverage - a.coverage,
      refer: (a, b) => b.referRate - a.referRate,
    };
    return [...f].sort(cmp[sort]);
  }, [rows, state, sort]);

  const totals = view.reduce(
    (s, r) => ({ adults: s.adults + r.adults, screened: s.screened + r.screened }),
    { adults: 0, screened: 0 },
  );

  /* Coverage is a fraction of a percent everywhere, so an absolute scale draws
     32 empty bars. Scale to the best-covered district in view: the bar then
     answers the question actually being asked — which districts are behind. */
  const bestCoverage = Math.max(...view.map((r) => r.coverage), 1e-9);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead
          title="District census"
          sub="Coverage is screenings divided by adult population — never a number typed in by hand."
          icon={<IcMap size={15} />}
          right={
            <div className="row wrap" style={{ gap: 9 }}>
              <select className="select select-xs" value={state} onChange={(e) => setState(e.target.value)} aria-label="Filter by state">
                <option value="all">All states</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="select select-xs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
                <option value="coverage">Sort: coverage</option>
                <option value="refer">Sort: referral rate</option>
                <option value="screened">Sort: screenings</option>
                <option value="pop">Sort: population</option>
                <option value="name">Sort: name</option>
              </select>
            </div>
          }
        />

        <div className="card-bd" style={{ paddingBottom: 8 }}>
          <div className="grid g3" style={{ gap: 14 }}>
            <Census label="Adults in catchment" value={int(totals.adults)} sub={`${view.length} districts`} />
            <Census label="Screened so far" value={int(totals.screened)} sub={pct(totals.screened / Math.max(1, totals.adults), 2) + " of the catchment"} />
            <Census label="Flagged for referral"
                    value={int(view.reduce((s, r) => s + Math.round(r.referRate * r.screened), 0))}
                    sub="routed to a clinician" />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>District</th><th>State</th>
                <th className="rt">Adults</th><th className="rt">Screened</th>
                <th style={{ minWidth: 156 }}>Coverage</th>
                <th className="rt">Refer</th><th className="rt">Watch</th>
                <th className="rt">Mean age</th><th className="rt">PHCs</th><th>Terrain</th>
              </tr>
            </thead>
            <tbody>
              {view.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="dim">{r.state}</td>
                  <td className="rt num">{int(r.adults)}</td>
                  <td className="rt num">{int(r.screened)}</td>
                  <td>
                    <div className="row" style={{ gap: 9 }}>
                      <div className="meter grow" style={{ minWidth: 60 }}>
                        <span style={{
                          width: `${Math.max(3, (r.coverage / bestCoverage) * 100)}%`,
                          background: r.coverage >= bestCoverage * 0.6 ? "var(--sage-ink)"
                            : r.coverage >= bestCoverage * 0.3 ? "var(--amber-ink)" : "var(--clay-ink)",
                        }} />
                      </div>
                      <span className="tiny num" style={{ minWidth: 44, textAlign: "right", fontWeight: 620 }}>
                        {pct(r.coverage, 2)}
                      </span>
                    </div>
                  </td>
                  <td className="rt num" style={{ color: BAND_VAR.refer, fontWeight: 620 }}>{pct(r.referRate, 0)}</td>
                  <td className="rt num" style={{ color: BAND_VAR.watch }}>{pct(r.watchRate, 0)}</td>
                  <td className="rt num">{r.meanAge ? r.meanAge.toFixed(0) : "—"}</td>
                  <td className="rt num">{r.phc}</td>
                  <td>
                    <div className="row" style={{ gap: 7 }}>
                      <div className="meter" style={{ width: 40, height: 6 }}>
                        <span style={{ width: `${r.terrain * 100}%`, background: "var(--clay-ink)" }} />
                      </div>
                      <span className="tiny dim num">{r.terrain.toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-ft">
          Coverage bars are scaled to the best-covered district shown, not to a target. Terrain is the block's mean slope index — a model input, since a steeper district carries more load per day.
        </div>
      </Card>

      <Card>
        <CardHead title="Where to send the next kits" sub="Districts with the widest gap between population and screenings" icon={<IcTarget size={15} />} />
        <div className="card-bd">
          <HBars
            fmt={(v) => `${int(v)} unscreened`}
            items={[...view]
              .sort((a, b) => (b.adults - b.screened) - (a.adults - a.screened))
              .slice(0, 8)
              .map((r, i) => ({
                label: r.name,
                value: r.adults - r.screened,
                color: i < 3 ? "var(--clay-line)" : "var(--sky-line)",
                note: r.state,
              }))}
          />
        </div>
      </Card>
    </div>
  );
}

function Census({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card card-quiet" style={{ padding: "15px 17px" }}>
      <div className="eyebrow">{label}</div>
      <div className="serif num" style={{ fontSize: 25, marginTop: 8, lineHeight: 1 }}>{value}</div>
      <div className="tiny dim" style={{ marginTop: 6 }}>{sub}</div>
    </div>
  );
}
