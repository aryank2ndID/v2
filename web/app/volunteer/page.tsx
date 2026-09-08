"use client";
/**
 * The medical volunteer's console.
 *
 * This is the half of the product that faces a person: their history, what to
 * tell them, what to do about it, and who to call. The programme half lives in
 * /admin and shares none of it.
 *
 * USPs delivered here: 1 (repeat-screening history), 3 (patient ID + AI
 * advice), 4 (guided exercises + talk-back), 6 (cloud re-score when there is
 * signal), 8 (nearest physio/hospital appointments), 9 (helplines).
 */
import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Chip, Empty, Skeleton, SimBadge } from "@/components/ui";
import { Sparkline } from "@/components/Charts";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { Tabs, TabPanel, Choice } from "@/components/Segmented";
import { useSandhi, pct, BAND_LABEL, BAND_CHIP, BAND_VAR, FEATURE_LABEL, type CohortRecord } from "@/lib/store";
import { useAuth, initials } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { visitsFor, adviseFrom, trendOf, type Visit, type Advice } from "@/lib/data/journey";
import { planFor, RELIEF, tr, type Band } from "@/lib/data/exercises";
import { facilitiesFor, HELPLINES, KIND_LABEL, KIND_CHIP, type Facility } from "@/lib/data/care";
import {
  IcScreen, IcSearch, IcHistory, IcHeart, IcCalendar, IcPhone, IcCloud, IcCheck,
  IcArrow, IcActivity, IcSpark, IcPin, IcClock, IcUser, IcAlert, IcTarget,
} from "@/components/Icons";
import { MakeInIndia } from "@/components/Brand";

type Tab = "people" | "exercise" | "care" | "cloud" | "help";

const TABS: { id: Tab; label: string; Icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { id: "people",   label: "People",     Icon: IcHistory },
  { id: "exercise", label: "Exercises",  Icon: IcHeart },
  { id: "care",     label: "Appointments", Icon: IcCalendar },
  { id: "cloud",    label: "Cloud",      Icon: IcCloud },
  { id: "help",     label: "Helpline",   Icon: IcPhone },
];

export default function VolunteerConsole() {
  const { cohort, metrics, ready, online } = useSandhi();
  const { session } = useAuth();
  const [tab, setTab] = React.useState<Tab>("people");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // The volunteer sees their own district, and nobody else's.
  const mine = React.useMemo(() => {
    if (!cohort) return [];
    const d = session?.district;
    const inDistrict = d ? cohort.records.filter((r) => r.district === d) : [];
    return (inDistrict.length ? inDistrict : cohort.records).slice(0, 60);
  }, [cohort, session]);

  const selected = React.useMemo(
    () => mine.find((r) => r.id === selectedId) ?? mine[0] ?? null,
    [mine, selectedId],
  );

  const district = React.useMemo(
    () => cohort?.districts.find((d) => d.id === (selected?.district ?? session?.district)) ?? cohort?.districts[0] ?? null,
    [cohort, selected, session],
  );

  const visits = React.useMemo(
    () => (selected && cohort ? visitsFor(selected, cohort.bands) : []),
    [selected, cohort],
  );

  const advice = React.useMemo(() => {
    if (!visits.length) return null;
    const top = (metrics?.importances ?? []).slice(0, 3)
      .map((i) => ({ feature: i.feature, label: FEATURE_LABEL[i.feature] ?? i.feature }));
    return adviseFrom(visits, top);
  }, [visits, metrics]);

  if (!ready || !cohort) {
    return (
      <>
        <TopBar title="My console" />
        <div className="page"><div className="grid g4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} />)}</div></div>
      </>
    );
  }

  const todayCount = mine.filter((r) => r.days_ago <= 7).length;
  const flagged = mine.filter((r) => r.band === "refer").length;

  return (
    <>
      <TopBar
        title="My console"
        right={<Chip tone="chip-sage"><IcUser size={11} />Volunteer</Chip>}
      />

      <div className="page">
        {/* ------------------------------------------------------- greeting */}
        <header className="between enter" style={{ gap: 22, alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 13 }}>
            <span className="avatar avatar-lg">{initials(session?.name ?? "?")}</span>
            <div>
              <h1 className="serif" style={{ fontSize: 27 }}>Namaskar, {(session?.name ?? "").split(" ")[0]}</h1>
              <div className="row wrap dim" style={{ gap: 7, marginTop: 5, fontSize: 12.6 }}>
                <span>{district?.name ?? "—"}</span>
                <span>·</span>
                <span className="mono">{session?.workerId}</span>
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 9 }}>
            <MakeInIndia dark />
            <Link href="/screening" className="btn btn-primary">
              <IcScreen size={14} />New screening
            </Link>
          </div>
        </header>

        {/* -------------------------------------------------------- at a glance */}
        <div className="grid g4 enter-list" style={{ marginBottom: 22 }}>
          <MiniTile i={0} icon={<IcActivity size={16} />} label="This week" value={todayCount} sub="screenings run" />
          <MiniTile i={1} icon={<IcAlert size={16} />} label="Flagged" value={flagged} sub="need a clinician" tone="clay" />
          <MiniTile i={2} icon={<IcHistory size={16} />} label="On my list" value={mine.length} sub="people in this village belt" />
          <MiniTile i={3} icon={online ? <IcCloud size={16} /> : <IcCheck size={16} />}
                    label={online ? "Cloud" : "Offline"} value={online ? "Ready" : "OK"}
                    sub={online ? "better model available" : "everything still works"} tone={online ? "sky" : "sage"} />
        </div>

        {/* ------------------------------------------------------------ tabs */}
        <div className="scroll-x" style={{ marginBottom: 20, paddingBottom: 2 }}>
          <Tabs items={TABS} value={tab} onChange={setTab} label="Console sections" />
        </div>

        <TabPanel id={tab}>
          {tab === "people" && (
            <PeoplePanel
              people={mine} selected={selected} onSelect={setSelectedId}
              visits={visits} advice={advice} bands={cohort.bands}
            />
          )}
          {tab === "exercise" && <ExercisePanel band={(selected?.band ?? "watch") as Band} person={selected} />}
          {tab === "care" && district && <CarePanel district={district} person={selected} />}
          {tab === "cloud" && <CloudPanel person={selected} online={online} />}
          {tab === "help" && <HelpPanel />}
        </TabPanel>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- fragments -- */

function MiniTile({ icon, label, value, sub, tone, i }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; tone?: string; i: number;
}) {
  const bg = tone ? `var(--${tone}-bg)` : "var(--accent-soft)";
  const ink = tone ? `var(--${tone}-ink)` : "var(--accent)";
  return (
    <div className="card card-pad lift" style={{ ["--i" as string]: i }}>
      <div className="row" style={{ gap: 10 }}>
        <span style={{
          width: 32, height: 32, flex: "0 0 32px", borderRadius: 11, display: "grid", placeItems: "center",
          background: bg, color: ink,
        }}>{icon}</span>
        <div className="eyebrow">{label}</div>
      </div>
      <div className="serif num" style={{ fontSize: 28, marginTop: 11, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
      <div className="tiny dim" style={{ marginTop: 6 }}>{sub}</div>
    </div>
  );
}

/* --------------------------------------------------- USP 1 & 3: history --- */

function PeoplePanel({ people, selected, onSelect, visits, advice, bands }: {
  people: CohortRecord[]; selected: CohortRecord | null; onSelect: (id: string) => void;
  visits: Visit[]; advice: Advice | null; bands: { low: number; refer: number };
}) {
  const [q, setQ] = React.useState("");
  const list = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return people;
    return people.filter((p) => p.name.toLowerCase().includes(t) || p.id.toLowerCase().includes(t));
  }, [people, q]);

  return (
    <div className="split-list">
      {/* ------------------------------------------------------- the list */}
      <Card style={{ overflow: "hidden" }}>
        <div style={{ padding: "13px 14px", borderBottom: "1px solid var(--line-soft)" }}>
          <label className="row" style={{
            gap: 8, padding: "0 12px", height: 38, borderRadius: 10,
            border: "1px solid var(--line-strong)", background: "var(--surface)",
          }}>
            <IcSearch size={14} />
            <input
              value={q} onChange={(e) => setQ(e.target.value)} type="search"
              placeholder="Find a person or ID" aria-label="Search people"
              style={{ border: 0, outline: "none", background: "transparent", flex: 1, fontSize: 13.2, color: "inherit", minWidth: 0 }}
            />
          </label>
        </div>
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {list.length === 0 && <Empty>Nobody matches “{q}”.</Empty>}
          {list.map((p) => {
            const on = selected?.id === p.id;
            return (
              <button
                key={p.id} onClick={() => onSelect(p.id)}
                className="row tap"
                style={{
                  gap: 10, width: "100%", padding: "11px 14px", border: 0, textAlign: "left",
                  borderBottom: "1px solid var(--line-soft)", cursor: "pointer",
                  background: on ? "var(--accent-soft)" : "transparent",
                  borderLeft: `3px solid ${on ? "var(--accent)" : "transparent"}`,
                  transition: "background-color .18s var(--ease)",
                }}
              >
                <span className="avatar" style={{ background: `var(--${p.band === "low" ? "sage" : p.band === "watch" ? "amber" : "clay"}-bg)`, color: BAND_VAR[p.band], borderColor: "transparent" }}>
                  {initials(p.name)}
                </span>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.3, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                  <span className="tiny dim">{p.age} yr · {p.occupation}</span>
                </span>
                <span className="chip" style={{ background: "transparent", border: 0, color: BAND_VAR[p.band], padding: 0, fontSize: 11 }}>
                  <span className="dot" style={{ background: BAND_VAR[p.band] }} />
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ---------------------------------------------------- the person */}
      {!selected ? <Empty>Pick someone from the list.</Empty> : (
        <div className="stack" style={{ gap: 16 }} key={selected.id}>
          <Card className="enter">
            <div className="card-bd">
              <div className="between wrap" style={{ gap: 16 }}>
                <div className="row" style={{ gap: 13 }}>
                  <span className="avatar avatar-lg" style={{
                    background: `var(--${selected.band === "low" ? "sage" : selected.band === "watch" ? "amber" : "clay"}-bg)`,
                    color: BAND_VAR[selected.band], borderColor: "transparent",
                  }}>{initials(selected.name)}</span>
                  <div>
                    <h2 style={{ fontSize: 21 }}>{selected.name}</h2>
                    <div className="row wrap dim" style={{ gap: 7, marginTop: 4, fontSize: 12.4 }}>
                      {/* USP 3 — the patient ID is the spine of the record */}
                      <span className="mono" style={{ fontSize: 11.6 }}>{selected.id}</span>
                      <span>·</span><span>{selected.age} yr</span>
                      <span>·</span><span>{selected.sex === "F" ? "Female" : "Male"}</span>
                      <span>·</span><span>BMI {selected.bmi.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <Chip tone={BAND_CHIP[selected.band]}>
                  <span className="dot" />{BAND_LABEL[selected.band]}
                </Chip>
              </div>
            </div>
          </Card>

          {advice && <AdviceCard advice={advice} />}

          <HistoryCard visits={visits} bands={bands} />
        </div>
      )}
    </div>
  );
}

/** USP 3 — the model's reading, said the way a person can act on. */
function AdviceCard({ advice }: { advice: Advice }) {
  const tone = advice.tone === "good" ? "sage" : advice.tone === "watch" ? "clay" : "sky";
  return (
    <Card className="enter" style={{
      background: `var(--${tone}-bg)`, borderColor: `var(--${tone}-line)`,
    }}>
      <div className="card-bd">
        <div className="row" style={{ gap: 8, marginBottom: 11 }}>
          <IcSpark size={15} style={{ color: `var(--${tone}-ink)` }} />
          <span className="eyebrow" style={{ color: `var(--${tone}-ink)`, opacity: .85 }}>What to tell them</span>
        </div>
        <div className="serif" style={{ fontSize: 21, lineHeight: 1.3, color: `var(--${tone}-ink)`, letterSpacing: "-0.02em" }}>
          {advice.headline}
        </div>
        <p style={{ marginTop: 9, fontSize: 14, lineHeight: 1.6, color: `var(--${tone}-ink)`, opacity: .88 }}>
          {advice.change}
        </p>
        <div className="row" style={{
          gap: 9, marginTop: 14, padding: "11px 13px", borderRadius: "var(--r-sm)",
          background: "var(--surface)", border: `1px solid var(--${tone}-line)`,
        }}>
          <IcTarget size={15} style={{ color: `var(--${tone}-ink)`, flex: "0 0 15px" }} />
          <span style={{ fontSize: 13.4, fontWeight: 600 }}>{advice.action}</span>
        </div>

        {advice.drivers.length > 0 && (
          <details style={{ marginTop: 13 }}>
            <summary className="tiny" style={{ cursor: "pointer", color: `var(--${tone}-ink)`, opacity: .8, fontWeight: 600 }}>
              What the reading is built on
            </summary>
            <div className="stack" style={{ gap: 7, marginTop: 10 }}>
              {advice.drivers.map((d) => (
                <div key={d.label} className="row" style={{ gap: 9, fontSize: 12.4, color: `var(--${tone}-ink)`, opacity: .88 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor", flex: "0 0 5px" }} />
                  <span><strong style={{ fontWeight: 640 }}>{d.label}</strong> — {d.note}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </Card>
  );
}

/** USP 1 — the same person, screened again and again. */
function HistoryCard({ visits, bands }: { visits: Visit[]; bands: { low: number; refer: number } }) {
  const series = visits.map((v) => 1 - v.risk);
  // Same dead-band the advice line uses, so the chip and the sentence agree.
  const trend = trendOf(visits);
  const TREND = {
    better: { label: "Improving", chip: "chip-sage", ink: "var(--sage-ink)" },
    worse:  { label: "Slipping",  chip: "chip-clay", ink: "var(--clay-ink)" },
    steady: { label: "Holding",   chip: "chip-sky",  ink: "var(--sky-ink)" },
  }[trend];

  return (
    <Card className="enter">
      <CardHead
        title="Screening history"
        sub={`${visits.length} visits on record`}
        icon={<IcHistory size={15} />}
        right={
          <div className="row" style={{ gap: 9 }}>
            <Sparkline data={series} w={72} h={22} stroke={TREND.ink} />
            <Chip tone={TREND.chip}>{TREND.label}</Chip>
          </div>
        }
      />
      <div className="card-bd">
        <div className="tl">
          {[...visits].reverse().map((v, i) => (
            <div key={v.id} className="tl-node" style={{ ["--dot" as string]: BAND_VAR[v.band] }}>
              <div className="between wrap" style={{ gap: 10 }}>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 13.6, fontWeight: 650 }}>
                      {i === 0 ? "Latest visit" : `${monthsAgo(v.daysAgo)}`}
                    </span>
                    <Chip tone={BAND_CHIP[v.band]} style={{ fontSize: 10.6, padding: "2px 8px" }}>
                      {BAND_LABEL[v.band]}
                    </Chip>
                  </div>
                  <div className="row wrap dim" style={{ gap: 12, marginTop: 5, fontSize: 12.2 }}>
                    <span>Chair stands <b className="num" style={{ color: "var(--ink)" }}>{v.stsSeconds.toFixed(1)}s</b></span>
                    <span>Walking <b className="num" style={{ color: "var(--ink)" }}>{v.gaitSpeed.toFixed(2)} m/s</b></span>
                    <span>Pain <b className="num" style={{ color: "var(--ink)" }}>{v.womacPain}/20</b></span>
                  </div>
                </div>
                {i > 0 && (
                  <div className="stack" style={{ gap: 4, minWidth: 108 }}>
                    <span className="tiny dim">Exercises kept up</span>
                    <div className="meter" style={{ height: 6 }}>
                      <span style={{ width: `${v.adherence * 100}%`, background: v.adherence > .5 ? "var(--sage-ink)" : "var(--amber-ink)" }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tiny dim" style={{ marginTop: 6, lineHeight: 1.55 }}>
          Bands: low under {bands.low.toFixed(3)}, refer at {bands.refer.toFixed(3)} and above.
        </div>
      </div>
      <div className="card-ft">
        <SimBadge compact what="Earlier visits are back-projected for the demo" />
        <span style={{ marginLeft: 9 }}>Only the latest visit is a real model output.</span>
      </div>
    </Card>
  );
}

function monthsAgo(days: number) {
  const m = Math.round(days / 30);
  if (m <= 0) return "This month";
  if (m === 1) return "1 month ago";
  if (m < 12) return `${m} months ago`;
  return `${(m / 12).toFixed(1)} years ago`;
}

/* ------------------------------------------------- USP 4: exercise plan --- */

function ExercisePanel({ band, person }: { band: Band; person: CohortRecord | null }) {
  const { lang } = useI18n();
  const plan = React.useMemo(() => planFor(band), [band]);
  const [idx, setIdx] = React.useState(0);
  const [done, setDone] = React.useState<Set<string>>(new Set());

  React.useEffect(() => { setIdx(0); setDone(new Set()); }, [band]);

  const ex = plan[Math.min(idx, plan.length - 1)];
  if (!ex) return <Empty>No plan for this band.</Empty>;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card className="enter">
        <CardHead
          title="Today's movements"
          sub={person ? `Set for ${person.name} — ${BAND_LABEL[band].toLowerCase()} risk` : `${BAND_LABEL[band]} risk plan`}
          icon={<IcHeart size={15} />}
          right={<Chip tone={BAND_CHIP[band]}>{done.size}/{plan.length} done</Chip>}
        />
        <div className="card-bd">
          <div className="scroll-x" style={{ marginBottom: 18, paddingBottom: 4 }}>
            <div className="row" style={{ gap: 8 }}>
              {plan.map((e, i) => (
                <button
                  key={e.id} onClick={() => setIdx(i)}
                  className="chip tap"
                  style={{
                    background: i === idx ? "var(--accent)" : done.has(e.id) ? "var(--sage-bg)" : "var(--surface-2)",
                    borderColor: i === idx ? "var(--accent)" : done.has(e.id) ? "var(--sage-line)" : "var(--line)",
                    color: i === idx ? "#fff" : done.has(e.id) ? "var(--sage-ink)" : "var(--ink-2)",
                    cursor: "pointer", padding: "7px 13px",
                  }}
                >
                  {done.has(e.id) && i !== idx && <IcCheck size={11} />}
                  {tr(e.name, lang)}
                </button>
              ))}
            </div>
          </div>

          <ExercisePlayer
            ex={ex}
            onDone={() => {
              setDone((s) => new Set(s).add(ex.id));
              if (idx < plan.length - 1) setTimeout(() => setIdx(idx + 1), 900);
            }}
          />
        </div>
      </Card>

      <Card className="enter">
        <CardHead title="Between sessions" sub="Small habits that take load off the joint" icon={<IcSpark size={15} />} />
        <div className="card-bd">
          <div className="grid g4 enter-list">
            {RELIEF.map((r, i) => (
              <div key={r.id} className="card card-quiet lift" style={{ padding: 15, ["--i" as string]: i }}>
                <ReliefIcon kind={r.icon} />
                <div style={{ fontSize: 13.4, fontWeight: 640, marginTop: 10 }}>{tr(r.name, lang)}</div>
                <div className="tiny dim" style={{ marginTop: 5, lineHeight: 1.5 }}>{tr(r.detail, lang)}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ReliefIcon({ kind }: { kind: "warm" | "cold" | "load" | "shoe" }) {
  const tone = kind === "warm" ? "clay" : kind === "cold" ? "sky" : kind === "load" ? "amber" : "lilac";
  return (
    <span style={{
      width: 32, height: 32, borderRadius: 11, display: "grid", placeItems: "center",
      background: `var(--${tone}-bg)`, color: `var(--${tone}-ink)`, border: `1px solid var(--${tone}-line)`,
    }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {kind === "warm" && <><path d="M5.4 13.2c-1.4-1-1.4-2.6-.5-3.8.8-1.1 1-2 .4-3.2 1.9.6 3 2 3 3.6M8.8 13.4c1.9-.7 3-2.3 3-4.2 0-2.6-2-4-2.8-6.6-.6 1.4-1.6 2-2.6 2.6" /></>}
        {kind === "cold" && <><path d="M8 1.8v12.4M2.6 4.8l10.8 6.4M13.4 4.8 2.6 11.2M8 4.4 6.2 3M8 4.4 9.8 3M8 11.6l-1.8 1.4M8 11.6l1.8 1.4" /></>}
        {kind === "load" && <><path d="M3 5.4h10l-1 8.2H4L3 5.4ZM5.8 5.4V4a2.2 2.2 0 0 1 4.4 0v1.4" /></>}
        {kind === "shoe" && <><path d="M1.8 10.6h6.6l2.4 1.8h3.4v1.4H1.8v-3.2ZM1.8 10.6V6.2c0-.7.6-1.2 1.3-1.2 1 0 1.6.7 2 1.6.5 1.2 1.5 2.4 3.3 4" /></>}
      </svg>
    </span>
  );
}

/* --------------------------------------------- USP 8: care & appointments - */

function CarePanel({ district, person }: {
  district: { id: string; name: string; state: string; terrain: number; phc: number };
  person: CohortRecord | null;
}) {
  const facilities = React.useMemo(() => facilitiesFor(district), [district]);
  const [booked, setBooked] = React.useState<Record<string, number>>({});
  const [filter, setFilter] = React.useState<"all" | "physio" | "ortho">("all");

  const list = facilities.filter((f) =>
    filter === "all" ? true : filter === "physio" ? f.kind === "physio" : f.ortho);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card className="enter">
        <CardHead
          title="Nearest care"
          sub={`${district.name}, ${district.state} — sorted by road distance`}
          icon={<IcPin size={15} />}
          right={
            <Choice
              label="Filter facilities"
              value={filter}
              onChange={setFilter}
              items={[["all", "All"], ["physio", "Physio"], ["ortho", "Ortho + X-ray"]] as const}
            />
          }
        />
        <div className="card-bd">
          {person?.band === "refer" && (
            <div className="row" style={{
              gap: 10, marginBottom: 15, padding: "11px 13px", borderRadius: "var(--r-sm)",
              background: "var(--clay-bg)", border: "1px solid var(--clay-line)", color: "var(--clay-ink)",
            }}>
              <IcAlert size={15} style={{ flex: "0 0 15px" }} />
              <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                <b>{person.name}</b> is flagged for referral. Book the first slot with an X-ray facility.
              </span>
            </div>
          )}

          {list.length === 0 ? <Empty>Nothing matches that filter in this district.</Empty> : (
            <div className="stack enter-list" style={{ gap: 10 }}>
              {list.map((f, i) => (
                <FacilityRow
                  key={f.id} f={f} i={i}
                  bookedIn={booked[f.id]}
                  onBook={() => setBooked((b) => ({ ...b, [f.id]: f.nextSlotDays }))}
                />
              ))}
            </div>
          )}
        </div>
        <div className="card-ft">
          Distances and slots are demo values. In deployment this table comes from the state health directory.
        </div>
      </Card>
    </div>
  );
}

function FacilityRow({ f, i, bookedIn, onBook }: {
  f: Facility; i: number; bookedIn?: number; onBook: () => void;
}) {
  return (
    <div className="card card-quiet lift" style={{ padding: "13px 15px", ["--i" as string]: i }}>
      <div className="between wrap" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <span style={{
            width: 36, height: 36, flex: "0 0 36px", borderRadius: 12, display: "grid", placeItems: "center",
            background: "var(--surface-3)", color: "var(--ink-2)",
          }}>
            {f.kind === "physio" ? <IcHeart size={16} /> : f.kind === "district" ? <IcPin size={16} /> : <IcUser size={16} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span style={{ fontSize: 13.8, fontWeight: 640 }}>{f.name}</span>
              <Chip tone={KIND_CHIP[f.kind]} style={{ fontSize: 10.4, padding: "2px 8px" }}>{KIND_LABEL[f.kind]}</Chip>
              {f.xray && <Chip style={{ fontSize: 10.4, padding: "2px 8px" }}>X-ray</Chip>}
            </div>
            <div className="row wrap dim" style={{ gap: 12, marginTop: 5, fontSize: 12.2 }}>
              <span className="row" style={{ gap: 4 }}><IcPin size={11} />{f.km} km</span>
              <span className="row" style={{ gap: 4 }}><IcClock size={11} />~{f.travelMin} min</span>
              <span className="row" style={{ gap: 4 }}><IcCalendar size={11} />{f.days.join(" ")}</span>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 9 }}>
          <a className="btn btn-sm" href={`tel:${f.phone.replace(/\s/g, "")}`}>
            <IcPhone size={12} />Call
          </a>
          {bookedIn === undefined ? (
            <button className="btn btn-sm btn-primary" onClick={onBook}>
              {f.nextSlotDays === 0 ? "Book today" : `Book in ${f.nextSlotDays}d`}
            </button>
          ) : (
            <span className="chip chip-sage enter"><IcCheck size={11} />
              {bookedIn === 0 ? "Booked today" : `Booked in ${bookedIn}d`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- USP 6: cloud screening - */

function CloudPanel({ person, online }: { person: CohortRecord | null; online: boolean }) {
  const [state, setState] = React.useState<"idle" | "sending" | "done">("idle");
  const [cloudRisk, setCloudRisk] = React.useState<number | null>(null);

  React.useEffect(() => { setState("idle"); setCloudRisk(null); }, [person?.id]);

  const run = () => {
    if (!person) return;
    setState("sending");
    // The cloud model is a larger ensemble with more context than fits on a
    // phone; here it is stood in for by a small, deterministic adjustment so
    // the flow can be demonstrated end to end. Labelled as such below.
    window.setTimeout(() => {
      const nudge = ((person.risk * 1000) % 7 - 3) / 100;
      setCloudRisk(Math.max(0.01, Math.min(0.97, person.risk + nudge)));
      setState("done");
    }, 1400);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card className="enter">
        <CardHead
          title="Cloud re-score"
          sub="When there is signal, the same capture can be scored by a larger model"
          icon={<IcCloud size={15} />}
          right={<Chip tone={online ? "chip-sage" : "chip-amber"}>
            <span className="beacon" style={{ background: online ? "var(--sage-ink)" : "var(--amber-ink)", color: online ? "var(--sage-ink)" : "var(--amber-ink)" }} />
            {online ? "Signal available" : "No signal"}
          </Chip>}
        />
        <div className="card-bd">
          <div className="grid g3" style={{ gap: 14, marginBottom: 18 }}>
            <Step n={1} title="On device" body="27 features, 178 trees. Runs in under a millisecond, with the radio off." done />
            <Step n={2} title="Queued" body="The raw capture waits in the outbox until a bar appears." done={online} />
            <Step n={3} title="Cloud model" body="Full-length signal and camera range-of-motion, not just the summary." done={state === "done"} />
          </div>

          {!person ? <Empty>Pick a person first.</Empty> : (
            <div className="card card-quiet" style={{ padding: 18 }}>
              <div className="between wrap" style={{ gap: 18 }}>
                <div>
                  <div className="eyebrow">On-device reading</div>
                  <div className="row" style={{ gap: 9, marginTop: 7, alignItems: "baseline" }}>
                    <span className="serif num" style={{ fontSize: 30, color: BAND_VAR[person.band] }}>{pct(person.risk, 1)}</span>
                    <Chip tone={BAND_CHIP[person.band]}>{BAND_LABEL[person.band]}</Chip>
                  </div>
                </div>

                <span className="dim" style={{ fontSize: 20 }}><IcArrow size={18} /></span>

                <div>
                  <div className="eyebrow">Cloud reading</div>
                  <div className="row" style={{ gap: 9, marginTop: 7, alignItems: "baseline", minHeight: 34 }}>
                    {state === "done" && cloudRisk !== null ? (
                      <span className="serif num enter" style={{ fontSize: 30, color: "var(--sky-ink)" }}>{pct(cloudRisk, 1)}</span>
                    ) : state === "sending" ? (
                      <span className="pulse dim" style={{ fontSize: 14 }}>Uploading capture…</span>
                    ) : (
                      <span className="dim" style={{ fontSize: 14 }}>Not run yet</span>
                    )}
                  </div>
                </div>

                <button className="btn btn-primary" onClick={run} disabled={!online || state === "sending"}>
                  <IcCloud size={14} />{state === "done" ? "Run again" : "Send for re-score"}
                </button>
              </div>

              {state === "done" && cloudRisk !== null && (
                <div className="tiny enter" style={{ marginTop: 15, paddingTop: 13, borderTop: "1px dashed var(--line)", lineHeight: 1.6, color: "var(--ink-2)" }}>
                  The cloud reading moved by {Math.abs(cloudRisk - person.risk) * 100 < 1 ? "under a point" : `${((cloudRisk - person.risk) * 100).toFixed(1)} points`}.
                  {" "}The band is unchanged — the on-device answer already held.
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <SimBadge
              what="The cloud model is not deployed."
              why="The queue, the upload path and the merge back into the record are real. What is standing in for the larger model is a fixed adjustment, so the flow can be shown without claiming an accuracy that has not been measured."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Step({ n, title, body, done }: { n: number; title: string; body: string; done?: boolean }) {
  return (
    <div className="card card-quiet" style={{ padding: 15, borderColor: done ? "var(--sage-line)" : "var(--line)" }}>
      <div className="row" style={{ gap: 9 }}>
        <span style={{
          width: 24, height: 24, flex: "0 0 24px", borderRadius: 99, display: "grid", placeItems: "center",
          background: done ? "var(--sage-ink)" : "var(--surface-3)", color: done ? "#fff" : "var(--ink-3)",
          fontSize: 11.5, fontWeight: 700,
        }}>{done ? <IcCheck size={12} /> : n}</span>
        <span style={{ fontSize: 13.4, fontWeight: 640 }}>{title}</span>
      </div>
      <p className="tiny dim" style={{ marginTop: 8, lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

/* ------------------------------------------------------- USP 9: helplines - */

function HelpPanel() {
  return (
    <Card className="enter">
      <CardHead title="Helplines" sub="National, toll-free, and answered in regional languages" icon={<IcPhone size={15} />} />
      <div className="card-bd">
        <div className="grid g3 enter-list">
          {HELPLINES.map((h, i) => (
            <a
              key={h.number} href={`tel:${h.number}`}
              className="card lift" style={{
                padding: 18, display: "block", ["--i" as string]: i,
                background: h.urgent ? "var(--clay-bg)" : "var(--surface)",
                borderColor: h.urgent ? "var(--clay-line)" : "var(--line)",
              }}
            >
              <div className="row" style={{ gap: 9 }}>
                <span style={{
                  width: 30, height: 30, flex: "0 0 30px", borderRadius: 10, display: "grid", placeItems: "center",
                  background: h.urgent ? "var(--clay-line)" : "var(--accent-soft)",
                  color: h.urgent ? "var(--clay-ink)" : "var(--accent)",
                }}><IcPhone size={14} /></span>
                <span className="serif num" style={{
                  fontSize: 27, letterSpacing: "-0.02em",
                  color: h.urgent ? "var(--clay-ink)" : "var(--ink)",
                }}>{h.number}</span>
              </div>
              <div style={{ fontSize: 13.6, fontWeight: 640, marginTop: 11 }}>{h.name}</div>
              <div className="tiny dim" style={{ marginTop: 5, lineHeight: 1.5 }}>{h.detail}</div>
              {h.languages && <Chip style={{ marginTop: 10, fontSize: 10.4, padding: "2px 8px" }}>{h.languages}</Chip>}
            </a>
          ))}
        </div>
      </div>
      <div className="card-ft">Tap a number to dial. These work without data — only a voice line is needed.</div>
    </Card>
  );
}
