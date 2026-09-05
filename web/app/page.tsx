"use client";
import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Stat, Section, SimBadge, Chip, Skeleton } from "@/components/ui";
import { HBars, Donut, Sparkline } from "@/components/Charts";
import { useSandhi, pct, int, BAND_VAR } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { IcArrow, IcScreen, IcClock, IcPin } from "@/components/Icons";

export default function Overview() {
  const { cohort, metrics, ready } = useSandhi();
  const { t } = useI18n();

  const stats = React.useMemo(() => {
    if (!cohort) return null;
    const r = cohort.records;
    const bands = { low: 0, watch: 0, refer: 0 } as Record<string, number>;
    r.forEach((x) => bands[x.band]++);
    const byWeek = new Array(12).fill(0);
    r.forEach((x) => { const w = Math.min(11, Math.floor((83 - x.days_ago) / 7)); if (w >= 0) byWeek[w]++; });
    const referred = r.filter((x) => x.band === "refer");
    return {
      n: r.length, bands, byWeek,
      referred: referred.length,
      followed: referred.filter((x) => x.followed_up).length,
      districts: new Set(r.map((x) => x.district)).size,
    };
  }, [cohort]);

  return (
    <>
      <TopBar title={t("nav.overview")} right={<Chip tone="chip-sky">SIH26004 · MDoNER</Chip>} />
      <div className="page">

        {/* ------------------------------------------------------ hero --- */}
        <div className="card" style={{ overflow: "hidden", position: "relative", background: "var(--surface)" }}>
          {/* medical-blue accent band along the top edge, like a govt banner */}
          <div style={{ height: 5, background: "linear-gradient(90deg, var(--sky-ink), var(--accent) 45%, var(--sky-ink))" }} />

          <div className="between" style={{ gap: 32, alignItems: "stretch", padding: "38px 40px 34px" }}>
            <div style={{ maxWidth: 660, minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
                <Chip tone="chip-sky">{t("hero.track")}</Chip>
                <Chip tone="chip-lilac">{t("hero.region")}</Chip>
                <Chip tone="chip-sage">{t("hero.scope")}</Chip>
              </div>
              <h1 className="serif" style={{ fontSize: 42, lineHeight: 1.06, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                {t("hero.h1a")}<br />{t("hero.h1b")}
              </h1>
              <p style={{ marginTop: 18, fontSize: 16, lineHeight: 1.7, color: "var(--ink-2)", maxWidth: 600 }}>
                {t("hero.body")}
              </p>
              <div className="row wrap" style={{ gap: 10, marginTop: 26 }}>
                <Link href="/screening" className="btn btn-primary btn-lg">
                  <IcScreen size={15} />{t("hero.run")}
                </Link>
                <Link href="/dashboard" className="btn btn-lg">
                  {t("hero.dash")}<IcArrow size={14} />
                </Link>
              </div>
            </div>

            {/* knee-joint illustration */}
            <KneeHero />
          </div>

          <div style={{ padding: "20px 24px 24px", borderTop: "1px solid var(--line)", background: "var(--surface-2)" }}>
            <div className="grid g4" style={{ maxWidth: 900 }}>
              {[
                ["Screening time", "3", "min", "30 s walk + 5 sit-to-stands"],
                ["Works offline", "100", "%", "inference runs on the phone"],
                ["Data sync", "Auto", "", "syncs when internet is available"],
                ["Model AUC", metrics ? metrics.test.auc.toFixed(3) : "—", "", "measured on held-out data"],
              ].map(([l, v, u, s]) => <Stat key={l} label={l} value={v} unit={u} sub={s} />)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <SimBadge
            what="No physical kit exists yet."
            why="The current build runs on a documented signal simulator. All software — capture, feature extraction, the model, offline queue, sync — works end to end. Real hardware is a four-week gap."
          />
        </div>

        {/* --------------------------------------------- what it measures - */}
        <Section
          title="What the kit measures"
          sub="Three independent channels, each carrying information the others cannot."
        >
          <div className="grid g3">
            {[
              { t: "Gait · 30 seconds", c: "var(--sky-bg)", l: "var(--sky-line)", k: "var(--sky-ink)",
                d: "Two IMUs above and below the knee at 100 Hz capture cadence, stride variability and left/right asymmetry.",
                w: "Osteoarthritic knees walk cautiously — shorter swing, longer double support, more variable strides." },
              { t: "Sit-to-stand · 5 reps", c: "var(--lilac-bg)", l: "var(--lilac-line)", k: "var(--lilac-ink)",
                d: "The thigh IMU during five chair rises measures total time, movement smoothness and rep-to-rep consistency.",
                w: "A loaded, painful knee cannot generate the same extensor power. A validated clinical test." }
            ].map((x) => (
              <div key={x.t} className="card" style={{ background: x.c, borderColor: x.l }}>
                <div className="card-bd">
                  <h3 style={{ color: x.k }}>{x.t}</h3>
                  <p className="small" style={{ marginTop: 8, lineHeight: 1.55, color: x.k, opacity: .88 }}>{x.d}</p>
                  <div style={{
                    marginTop: 11, paddingTop: 10, borderTop: `1px dashed ${x.l}`,
                    fontSize: 11.8, lineHeight: 1.5, color: x.k, opacity: .78,
                  }}>
                    <span className="eyebrow" style={{ color: x.k, opacity: .7, display: "block", marginBottom: 3 }}>Why it works</span>
                    {x.w}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ------------------------------------------- hardware ablation -- */}
        <Section
          title="Why the hardware matters"
          sub="Even the intake questionnaire alone is a decent predictor. The kit adds what a question cannot reach."
        >
          <Card>
            <CardHead title="Discrimination by sensor set" sub="AUC on held-out data" />
            <div className="card-bd">
              {metrics ? (
                <HBars
                  max={1}
                  fmt={(v) => v.toFixed(3)}
                  items={Object.entries(metrics.ablation).filter(([k]) => !k.includes("acoustic")).map(([k, v], i) => ({
                    label: k,
                    value: v.auc,
                    color: ["var(--surface-3)", "var(--sky-line)", "var(--lilac-line)", "var(--sage-line)"][i],
                    note: `${v.n_features} features`,
                  }))}
                />
              ) : <Skeleton h={120} />}
              <div className="tiny dim" style={{ marginTop: 14, lineHeight: 1.55 }}>
                Age, BMI, occupation and pain do most of the work. The kit provides a measurable lift on top of that.
              </div>
            </div>
          </Card>
        </Section>

        {/* -------------------------------------------------- programme --- */}
        <Section
          title="Programme view"
          sub={<>Live figures from the registry — {stats ? int(stats.n) : "—"} screenings across {stats?.districts ?? "—"} districts.</>}
          right={<Link href="/dashboard" className="btn btn-sm">Open dashboard<IcArrow size={13} /></Link>}
        >
          {stats && cohort ? (
            <div className="grid g4">
              <Stat label="Screenings" value={int(stats.n)}
                    sub={<>across {stats.districts} districts in 8 states</>}
                    trend={<span style={{ marginLeft: 6 }}><Sparkline data={stats.byWeek} w={54} h={18} /></span>} />
              <Stat label="Flagged for referral" value={int(stats.referred)}
                    unit={`· ${pct(stats.referred / stats.n, 0)}`}
                    sub={<>{int(stats.followed)} confirmed seen at a PHC</>} />
              <Stat label="Referral follow-up" value={pct(stats.followed / Math.max(1, stats.referred), 0)}
                    sub="the metric that decides whether this mattered" />
              <div className="card card-pad row" style={{ gap: 14 }}>
                <Donut size={78} thickness={12}
                       slices={[
                         { label: "Low", value: stats.bands.low, color: "var(--sage-line)" },
                         { label: "Watch", value: stats.bands.watch, color: "var(--amber-line)" },
                         { label: "Refer", value: stats.bands.refer, color: "var(--clay-line)" },
                       ]} />
                <div className="stack" style={{ gap: 5, minWidth: 0 }}>
                  <div className="eyebrow">Risk bands</div>
                  {(["low", "watch", "refer"] as const).map((b) => (
                    <div key={b} className="row" style={{ gap: 6, fontSize: 12 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: BAND_VAR[b] }} />
                      <span className="dim" style={{ textTransform: "capitalize", width: 40 }}>{b}</span>
                      <span className="num" style={{ fontWeight: 560 }}>{pct(stats.bands[b] / stats.n, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : <div className="grid g4">{[0,1,2,3].map(i => <Skeleton key={i} />)}</div>}
        </Section>

        {/* ----------------------------------------------------- why NER -- */}
        <Section
          title="Why the North-East"
          sub="A design built for this region's specific realities."
        >
          <div className="grid g3">
            {[
              { i: <IcPin size={15} />, t: "Terrain is the exposure",
                d: "Terrace farming and slope walking put cyclic load through knees that plains-state models do not weight. Slope index is a model input, not decoration." },
              { i: <IcClock size={15} />, t: "The referral chain is long",
                d: "X-ray sits at the district hospital, often half a day away over bad roads. Screening has to happen where the patient already is." },
            ].map((x) => (
              <Card key={x.t}>
                <div className="card-bd">
                  <span style={{
                    display: "inline-grid", placeItems: "center", width: 30, height: 30,
                    borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--line)",
                    color: "var(--ink-2)", marginBottom: 11,
                  }}>{x.i}</span>
                  <h3>{x.t}</h3>
                  <p className="small muted" style={{ marginTop: 7, lineHeight: 1.6 }}>{x.d}</p>
                </div>
              </Card>
            ))}
            <Card>
              <div className="card-bd">
                <span style={{
                  display: "inline-grid", placeItems: "center", width: 30, height: 30,
                  borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--line)",
                  color: "var(--ink-2)", marginBottom: 11,
                }}><IcScreen size={15} /></span>
                <h3>Works with no signal</h3>
                <p className="small muted" style={{ marginTop: 7, lineHeight: 1.6 }}>
                  An app that needs a network is an app that does not run. Inference, storage and results work with the radio off; sync is a background convenience.
                </p>
              </div>
            </Card>
          </div>
        </Section>

        <div className="card" style={{ marginTop: 30, background: "var(--surface-2)", borderColor: "var(--line)" }}>
          <div className="row" style={{ gap: 12, alignItems: "flex-start", padding: "16px 20px" }}>
            <span style={{
              display: "inline-grid", placeItems: "center", width: 28, height: 28, flex: "0 0 28px",
              borderRadius: 8, background: "var(--amber-bg)", border: "1px solid var(--amber-line)", color: "var(--amber-ink)",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6.3" /><path d="M8 5v3.6M8 11h.01" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>This is a screening and triage aid — not a diagnostic device.</div>
              <div className="small dim" style={{ marginTop: 4, lineHeight: 1.6, maxWidth: 780 }}>
                A raised risk band routes the person to a qualified clinician — nothing more.
              </div>
            </div>
          </div>
        </div>

        <style>{`@media (max-width: 900px){ .hero-strip{ grid-template-columns: repeat(2,1fr) !important } }`}</style>
      </div>
    </>
  );
}

/* A human femur → tibia joint with the two sensor cuffs placed above/below.
   Drawn in the same hand-rolled SVG language as the charts. */
function KneeHero() {
  return (
    <div aria-hidden style={{
      alignItems: "center", justifyContent: "center", flex: "1 1 300px",
      minWidth: 260, position: "relative",
    }} className="knee-hero">
      <svg width="250" height="210" viewBox="0 0 250 210" fill="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="femur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sky-line)" />
            <stop offset="1" stopColor="var(--sky-ink)" />
          </linearGradient>
        </defs>

        {/* femur */}
        <path d="M108 14c-6 30-9 50-6 72l-8 8-7-6c-7 10-11 20-13 30l-15-6c5-16 10-28 18-38-4-6-6-14-7-23-2-10-1-24 2-38 2-11 5-19 9-25l27 26z"
              fill="var(--surface-3)" stroke="var(--ink-4)" strokeWidth="1.4" />
        <path d="M108 14c-6 30-9 50-6 72" fill="none" stroke="var(--sky-ink)" strokeWidth="2.4" strokeLinecap="round" />

        {/* tibia */}
        <path d="M84 92l-4 8c7 16 17 28 30 38 3 8 5 18 7 30 2 14 4 24 6 30l17-2c-2-8-4-18-6-30-1-10-3-20-6-28 10-14 18-29 24-46l-16-6c-5 14-12 26-22 38-8-9-18-17-30-26z"
              fill="var(--surface-3)" stroke="var(--ink-4)" strokeWidth="1.4" />
        <path d="M80 100c7 16 13 26 20 34" fill="none" stroke="var(--clay-ink)" strokeWidth="2.4" strokeLinecap="round" />

        {/* joint line */}
        <path d="M78 98c24 8 48 9 72 2" stroke="var(--clay-ink)" strokeWidth="1.6" strokeDasharray="4 3" strokeLinecap="round" />

        {/* sensor cuffs */}
        <g>
          <rect x="92" y="34" width="42" height="12" rx="6" fill="var(--sky-bg)" stroke="var(--sky-ink)" strokeWidth="1.3" />
          <circle cx="104" cy="40" r="2.2" fill="var(--sky-ink)" />
          <circle cx="112" cy="40" r="2.2" fill="var(--sky-ink)" />
          <circle cx="120" cy="40" r="2.2" fill="var(--sky-ink)" />
          <text x="140" y="44" fontSize="10" fill="var(--sky-ink)" fontWeight="600">IMU·thigh</text>
        </g>
        <g>
          <rect x="70" y="112" width="42" height="12" rx="6" fill="var(--lilac-bg)" stroke="var(--lilac-ink)" strokeWidth="1.3" />
          <circle cx="82" cy="118" r="2.2" fill="var(--lilac-ink)" />
          <circle cx="90" cy="118" r="2.2" fill="var(--lilac-ink)" />
          <circle cx="98" cy="118" r="2.2" fill="var(--lilac-ink)" />
          <text x="118" y="122" fontSize="10" fill="var(--lilac-ink)" fontWeight="600">IMU·shin</text>
        </g>
      </svg>
      <span style={{
        position: "absolute", bottom: 2, fontSize: 10.5, color: "var(--ink-4)",
        letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
      }}>inertial · 100 Hz</span>
    </div>
  );
}
