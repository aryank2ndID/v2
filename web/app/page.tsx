"use client";
import * as React from "react";
import Link from "next/link";
import { TopBar } from "@/components/Shell";
import { Card, CardHead, Stat, Section, SimBadge, Chip, KV, Skeleton } from "@/components/ui";
import { ArchDiagram } from "@/components/ArchDiagram";
import { HBars, Donut, Sparkline } from "@/components/Charts";
import { useSandhi, pct, int, BAND_VAR } from "@/lib/store";
import { IcArrow, IcScreen, IcSpark, IcClock, IcPin } from "@/components/Icons";

const BOM: [string, number, number][] = [
  ["ESP32-WROOM-32 module", 1, 285],
  ["MPU-6050 6-axis IMU", 2, 96],
  ["Piezo contact disc + INA333 preamp", 1, 195],
  ["18650 cell + TP4056 charger board", 1, 210],
  ["Neoprene cuff, strap, buckle", 2, 130],
  ["Enclosure, 3D printed PETG", 2, 90],
  ["Two-layer PCB, JST, passives, wire", 1, 240],
  ["Switch, USB-C port, fasteners", 1, 85],
  ["Assembly + QA labour, at volume", 1, 320],
];

export default function Overview() {
  const { cohort, metrics, ready } = useSandhi();

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

  const bomTotal = BOM.reduce((s, [, q, p]) => s + q * p, 0);

  return (
    <>
      <TopBar title="Overview" right={<Chip tone="chip-sky">SIH26004 · MDoNER</Chip>} />
      <div className="page">

        {/* ------------------------------------------------------ hero --- */}
        <div className="card" style={{ overflow: "hidden", position: "relative" }}>
          <div style={{
            background: "linear-gradient(122deg, var(--sky-bg) 0%, var(--lilac-bg) 44%, var(--blush-bg) 100%)",
            padding: "30px 32px 28px", position: "relative",
          }}>
            <div className="noise-scrim" />
            <div style={{ position: "relative", maxWidth: 720 }}>
              <div className="row" style={{ gap: 8, marginBottom: 14 }}>
                <Chip tone="chip-sky">Hardware track</Chip>
                <Chip tone="chip-lilac">North-Eastern Region</Chip>
                <Chip tone="chip-sage">Screening, not diagnosis</Chip>
              </div>
              <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
                Three minutes, one strap,<br />no doctor and no signal.
              </h1>
              <p style={{ marginTop: 14, fontSize: 15.4, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620 }}>
                <strong style={{ fontWeight: 600, color: "var(--ink)" }}>SANDHI</strong> is a
                ₹{int(bomTotal)} wearable kit and an offline model that let an ASHA worker
                screen a village for early knee osteoarthritis risk — from a 30-second walk,
                five sit-to-stands, and a listen to the joint itself.
              </p>
              <div className="row wrap" style={{ gap: 9, marginTop: 20 }}>
                <Link href="/screening" className="btn btn-primary btn-lg">
                  <IcScreen size={15} />Run a screening
                </Link>
                <Link href="/system" className="btn btn-lg">
                  What is real, what is simulated<IcArrow size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderTop: "1px solid var(--line)" }}
               className="hero-strip">
            {[
              ["Screening time", "3", "min", "30 s walk + 5 sit-to-stands"],
              ["Kit cost", `₹${int(bomTotal)}`, "", "bill of materials, one unit"],
              ["Works offline", "100", "%", "inference runs on the phone"],
              ["Held-out AUC", metrics ? metrics.test.auc.toFixed(3) : "—", "", "synthetic cohort — see model card"],
            ].map(([l, v, u, s], i) => (
              <div key={i} style={{
                padding: "15px 18px",
                borderRight: i < 3 ? "1px solid var(--line-soft)" : "none",
              }}>
                <div className="eyebrow">{l}</div>
                <div className="row" style={{ gap: 4, alignItems: "baseline", marginTop: 5 }}>
                  <span className="serif num" style={{ fontSize: 25, lineHeight: 1 }}>{v}</span>
                  <span className="small dim">{u}</span>
                </div>
                <div className="tiny dim" style={{ marginTop: 5 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <SimBadge
            what="No physical kit exists yet."
            why={`Every waveform in this build is generated by a documented signal simulator, and the model is trained on a ${metrics ? int(metrics.cohort.total) : "20,000"}-subject synthetic cohort. The software around it — feature extraction, the model, the offline queue, the sync server — is real and runs end to end. The System page maps this line precisely.`}
          />
        </div>

        {/* --------------------------------------------- what it measures - */}
        <Section
          title="What the kit actually measures"
          sub="Three independent physical channels, chosen because each one carries information the others do not."
        >
          <div className="grid g3">
            {[
              { t: "Gait, 30 seconds", c: "var(--sky-bg)", l: "var(--sky-line)", k: "var(--sky-ink)",
                d: "Two IMUs above and below the knee at 100 Hz. Cadence, stance fraction, knee flexion excursion, stride-to-stride variability, left/right asymmetry.",
                w: "Osteoarthritic knees walk cautiously: shorter swing, longer double support, more variable strides." },
              { t: "Sit-to-stand, 5 reps", c: "var(--lilac-bg)", l: "var(--lilac-line)", k: "var(--lilac-ink)",
                d: "The same thigh IMU during five chair rises. Total time, peak angular velocity, movement smoothness, rep-to-rep consistency.",
                w: "A loaded, painful knee cannot generate the same extensor power. The five-times sit-to-stand is already a validated clinical test." },
              { t: "Joint acoustics", c: "var(--blush-bg)", l: "var(--blush-line)", k: "var(--blush-ink)",
                d: "A piezo contact disc on the medial joint line at 4 kHz during a slow flexion sweep. Crepitus burst rate, high-frequency energy ratio, spectral entropy.",
                w: "Degenerate cartilage grates. Vibroarthrography hears roughness that gait compensation can hide." },
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
          title="Does the hardware earn its place?"
          sub="The honest test for a hardware submission: how much better is the kit than just asking the questions? Each row adds one channel, retrains from scratch and re-scores the same held-out split."
        >
          <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)" }}>
            <Card>
              <CardHead title="Discrimination by sensor set" sub="AUC on held-out synthetic cohort" icon={<IcSpark size={14} />} />
              <div className="card-bd">
                {metrics ? (
                  <HBars
                    max={1}
                    fmt={(v) => v.toFixed(3)}
                    items={Object.entries(metrics.ablation).map(([k, v], i) => ({
                      label: k,
                      value: v.auc,
                      color: ["var(--surface-3)", "var(--sky-line)", "var(--lilac-line)", "var(--sage-line)"][i],
                      note: `${v.n_features} features`,
                    }))}
                  />
                ) : <Skeleton h={120} />}
                <div className="tiny dim" style={{ marginTop: 14, lineHeight: 1.55 }}>
                  The intake questionnaire alone is already a decent predictor — age, BMI, occupation and
                  pain do most of the work. The kit's contribution is the part a question cannot reach:
                  {" "}<strong style={{ color: "var(--ink-2)" }}>+{metrics ? ((metrics.ablation["full kit (+ acoustic)"].auc - metrics.ablation["intake only (no kit)"].auc) * 100).toFixed(1) : "—"} AUC points</strong>,
                  most of it from the acoustic channel.
                </div>
              </div>
            </Card>

            <Card>
              <CardHead title="Bill of materials" sub="one field unit, retail quantities" />
              <div className="card-bd" style={{ paddingTop: 8 }}>
                <table className="tbl" style={{ fontSize: 12.4 }}>
                  <tbody>
                    {BOM.map(([n, q, p]) => (
                      <tr key={n}>
                        <td style={{ padding: "5.5px 0" }}>{n}</td>
                        <td className="rt dim" style={{ padding: "5.5px 8px", width: 28 }}>×{q}</td>
                        <td className="rt" style={{ padding: "5.5px 0", width: 62, fontWeight: 540 }}>
                          ₹{int(q * p)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="between" style={{
                  marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)",
                }}>
                  <span style={{ fontWeight: 600 }}>Total</span>
                  <span className="serif num" style={{ fontSize: 20 }}>₹{int(bomTotal)}</span>
                </div>
                <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.5 }}>
                  Under the ₹3,000 target with assembly included. The phone is the ASHA worker&rsquo;s
                  existing device and is not in the bill. Prices are Indian retail at unit
                  quantity; a 500-unit run takes roughly 30% out.
                </div>
              </div>
            </Card>
          </div>
        </Section>

        {/* -------------------------------------------------- architecture */}
        <Section
          title="System architecture"
          sub="Five layers, built riskiest-first. The signal spec and the model came before the backend on purpose — the backend is the part that cannot fail."
        >
          <ArchDiagram />
        </Section>

        {/* -------------------------------------------------- programme --- */}
        <Section
          title="Programme view"
          sub={<>Live figures from the scored registry this build ships with — {stats ? int(stats.n) : "—"} screenings across {stats?.districts ?? "—"} districts. Synthetic, and labelled as such everywhere it appears.</>}
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
                    sub="the metric that decides whether any of this mattered" />
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
          title="Why the North-East, specifically"
          sub="A design that could be for any state is a design that answers no problem statement."
        >
          <div className="grid g3">
            {[
              { i: <IcPin size={15} />, t: "The terrain is the exposure",
                d: "Terrace farming, head-load portering and daily slope walking put cyclic load through the knee that plains-state risk models do not weight. Slope index and stairs-per-day are model inputs, not decoration." },
              { i: <IcClock size={15} />, t: "The referral chain is long",
                d: "Radiography sits at the district hospital, often a half-day away over bad road. Screening has to happen where the patient already is, and only send the people who need the trip." },
              { i: <IcSpark size={15} />, t: "The last mile has no signal",
                d: "An app that needs a network is an app that does not run. Inference, storage and the entire result screen work with the radio off; sync is a background convenience." },
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
          </div>
        </Section>

        <div className="card card-quiet" style={{ marginTop: 30, padding: "15px 18px" }}>
          <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--ink-3)", marginTop: 1 }}><IcSpark size={15} /></span>
            <div>
              <div style={{ fontWeight: 570, fontSize: 13 }}>This is a screening and triage aid. It is not a diagnostic device.</div>
              <div className="small dim" style={{ marginTop: 4, lineHeight: 1.55, maxWidth: 780 }}>
                No output of this system is a diagnosis of osteoarthritis. A raised risk band is an
                instruction to route the person to a qualified clinician, nothing more. The model has
                never seen a patient — see the model card for exactly what it has seen.
              </div>
            </div>
          </div>
        </div>

        <style>{`@media (max-width: 900px){ .hero-strip{ grid-template-columns: repeat(2,1fr) !important } }`}</style>
      </div>
    </>
  );
}
