"use client";
/**
 * SANDHI — the public landing page.
 *
 * Deliberately not the app: no rail, no header bar, no acronyms. One light
 * blue surface the whole way down, in a steady rhythm — kicker, heading,
 * lead, then the thing itself. It has one job: make someone who has never
 * heard of osteoarthritis understand this in about a minute.
 */
import * as React from "react";
import Link from "next/link";
import "./landing.css";

import { GaitStage } from "@/components/landing/GaitStage";
import { KitSection } from "@/components/landing/KitSection";
import {
  Wash, Sparkles, GlowCard, TiltCard, TracingBeam,
  WordReveal, FlipWords, Squiggle, MagneticButton,
} from "@/components/landing/fx";
import { useReveal, useCountUp } from "@/lib/useReveal";
import { useAuth, ROLE_HOME } from "@/lib/auth";

export default function Landing() {
  const { ref, armed } = useReveal<HTMLDivElement>();
  const { session } = useAuth();
  const appHref = session ? ROLE_HOME[session.role] : "/login";
  const appLabel = session ? "Open my console" : "I'm a health worker";

  return (
    <div className="lp" data-reveal={armed ? "on" : undefined} ref={ref}>

      {/* ====================================================== hero ====== */}
      <section style={{ paddingTop: "clamp(30px, 4vw, 54px)", paddingBottom: "clamp(46px, 6vw, 84px)" }}>
        <Wash />
        <Sparkles count={16} />

        <div className="lp-wrap-wide" style={{ position: "relative", zIndex: 2 }}>
          {/* the wordmark sits in the page, not in a bar across the top */}
          <div className="lp-rise" style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: "clamp(30px, 4vw, 52px)" }}>
            <span style={{
              width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", flex: "0 0 40px",
              background: "linear-gradient(140deg, #4A9EFF, #8FC6FF)",
              boxShadow: "0 8px 18px -8px rgba(74,158,255,.9)",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 5v5.4c0 1.5 1.1 2.4 2.4 2.9" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
                <path d="M16 19v-5c0-1.5-1.1-2.5-2.5-2.9" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
                <path d="M9.3 12c2.4 1.7 4.6 2 6.8.5" stroke="#DCEEFF" strokeWidth="1.9" strokeLinecap="round" strokeDasharray="1.6 2.2" />
              </svg>
            </span>
            <span>
              <span style={{ display: "block", fontWeight: 800, fontSize: 18, letterSpacing: "-.025em" }}>SANDHI</span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-3)", fontWeight: 560, marginTop: -1 }}>
                knee screening for the hills
              </span>
            </span>
          </div>

          <div className="lp-hero-grid" style={{
            display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, .9fr)",
            gap: "clamp(30px, 4.5vw, 58px)", alignItems: "center",
          }}>
            <div>
              <span className="lp-pill lp-rise" style={{ ["--d" as string]: 0 }}>
                <span className="lp-dot lp-live-dot" style={{ background: "var(--blue)", color: "var(--blue)" }} />
                Made for health camps in India's North-East
              </span>

              <h1 className="lp-display" style={{ marginTop: 22 }}>
                <WordReveal text="Your knees tell the truth" delay={0.12} />
                <br />
                <span className="lp-mark"><WordReveal text="years before" delay={0.46} /></span>{" "}
                <span className="lp-grad fx-phrase" style={{ ["--fd" as string]: ".74s" }}>the pain does.</span>
              </h1>
              <Squiggle width={210} />

              <p className="lp-lead lp-rise" style={{ ["--d" as string]: 3, marginTop: 22, maxWidth: 520 }}>
                Walk for thirty seconds. Stand up from a chair five times. That is the whole
                test — and a health worker's phone tells you, right there, whether your knees
                need a doctor. No lab, no X-ray, no internet.
              </p>

              <div className="lp-rise" style={{ ["--d" as string]: 4, marginTop: 30, display: "flex", gap: 13, flexWrap: "wrap" }}>
                <MagneticButton href="#how" className="lp-btn-primary">
                  See how it works<ArrowIcon />
                </MagneticButton>
                <Link href={appHref} className="lp-btn lp-btn-soft">{appLabel}</Link>
              </div>

              <div className="lp-rise" style={{ ["--d" as string]: 5, marginTop: 38, display: "flex", gap: 32, flexWrap: "wrap" }}>
                <HeroStat to={3} suffix=" min" label="start to answer" />
                <HeroStat to={30} suffix="s" label="of walking, that's all" />
                <HeroStat zero="none" label="internet needed" />
              </div>
            </div>

            <div className="lp-scale" style={{ ["--d" as string]: 2 }}>
              <TiltCard max={5}><GaitStage /></TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================== marquee ====== */}
      <div className="lp-marquee" aria-hidden>
        <div className="lp-marquee-track">
          {[0, 1].map((dup) => (
            <React.Fragment key={dup}>
              {[
                "One in four rural adults lives with knee osteoarthritis",
                "The damage starts a decade before the limp",
                "Nearest X-ray: half a day over bad roads",
                "Caught early, it is exercise — not surgery",
                "Terrace farming loads a knee like nothing else",
                "Works with the phone in airplane mode",
              ].map((t) => (
                <span className="lp-marquee-item" key={t + dup}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--blue)" }} />
                  {t}
                </span>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* =================================================== problem ====== */}
      <section id="problem" style={{ padding: "clamp(70px, 8.5vw, 116px) 0", scrollMarginTop: 30 }}>
        <div className="lp-wrap">
          <div style={{ maxWidth: 760 }}>
            <span className="lp-kicker lp-rise" style={{ color: "var(--blue)" }}>Why it matters</span>
            <h2 className="lp-h2 lp-rise" style={{ ["--d" as string]: 1, marginTop: 15 }}>
              By the time a knee hurts enough to walk to a hospital,
              <span className="lp-grad"> the cartilage is already gone.</span>
            </h2>
            <p className="lp-lead lp-rise" style={{ ["--d" as string]: 2, marginTop: 20 }}>
              Osteoarthritis does not announce itself. It quietly changes how a person walks —
              a shorter step here, a little more caution there — for years before it becomes
              pain worth complaining about. Those changes are measurable. Nobody was measuring
              them, because measuring them used to need a laboratory.
            </p>
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(246px, 1fr))", marginTop: 48 }}>
            <BigStat tint="lp-tint-blue" tone="#4A9EFF" to={26} suffix="%" head="of rural adults"
                     body="live with knee osteoarthritis. In Assam's tea garden communities the measured figure was 29%." />
            <BigStat tint="lp-tint-mint" tone="#3FCDA6" to={10} suffix=" yrs" head="of quiet warning"
                     body="The window where the gentle things — exercise, weight, better footwear — still change how this ends." />
            <BigStat tint="lp-tint-lav" tone="#B7A8FF" to={1} suffix=" in 2" head="never get checked"
                     body="Not because they refuse. Because the nearest place that could check them is a day away." />
          </div>
        </div>
      </section>

      {/* ======================================================= how ====== */}
      <section id="how" className="lp-band-tint" style={{ padding: "clamp(64px, 8vw, 100px) 0", scrollMarginTop: 30 }}>
        <div className="lp-wrap">
          <div style={{ maxWidth: 740, marginBottom: 46 }}>
            <span className="lp-kicker lp-rise" style={{ color: "var(--blue)" }}>How it works</span>
            <h2 className="lp-h2 lp-rise" style={{ ["--d" as string]: 1, marginTop: 15 }}>
              Three minutes, and it can happen{" "}
              <FlipWords words={["in a courtyard.", "on a verandah.", "at a tea garden.", "beside a field."]} />
            </h2>
            <p className="lp-lead lp-rise" style={{ ["--d" as string]: 2, marginTop: 20 }}>
              A health worker can learn the whole thing in an afternoon. The person being
              screened does not have to undress, lie down, or go anywhere.
            </p>
          </div>

          <TracingBeam>
            <div className="lp-steps">
              <Step n="01" tint="lp-tint-blue" tone="#2F7FE0" d={0}
                    title="Two little sensors go on"
                    body="One above the knee, one below, over clothing. Forty seconds. They are lighter than a wristwatch and nothing sticks to skin."
                    icon={<StrapGlyph />} />
              <Step n="02" tint="lp-tint-mint" tone="#28B392" d={1}
                    title="A short walk, then five stands"
                    body="Normal pace, flat ground, thirty seconds. Then stand up from a chair five times. That is everything the kit needs."
                    icon={<WalkGlyph />} />
              <Step n="03" tint="lp-tint-lav" tone="#7C63E8" d={2}
                    title="The answer, read out loud"
                    body="Green, amber or red, with one sentence in the person's own language — and it works with the phone in airplane mode."
                    icon={<ResultGlyph />} />
            </div>
          </TracingBeam>
        </div>
      </section>

      {/* ==================================================== bento ======= */}
      <section style={{ padding: "clamp(70px, 8.5vw, 112px) 0" }}>
        <div className="lp-wrap">
          <div style={{ maxWidth: 720, marginBottom: 42 }}>
            <span className="lp-kicker lp-rise" style={{ color: "var(--blue)" }}>What makes it different</span>
            <h2 className="lp-h2 lp-rise" style={{ ["--d" as string]: 1, marginTop: 15 }}>
              Things a questionnaire, an X-ray queue or a fitness band cannot do.
            </h2>
          </div>

          <div className="lp-bento">
            <Bento className="wide tall" tone="#4A9EFF" tint="lp-tint-blue" d={0} big
                   title="It works with the radio off"
                   body="Every part of the answer — reading the sensors, scoring the risk, printing the slip — happens on the phone in the worker's hand. Syncing to the district office is a convenience for later, never something the person in front of you has to wait for." />
            <Bento tone="#3FCDA6" tint="lp-tint-mint" d={1}
                   title="It speaks their language"
                   body="Seventeen languages, and the guidance reads itself aloud for anyone who would rather listen than read." />
            <Bento tone="#B7A8FF" tint="lp-tint-lav" d={2}
                   title="It remembers"
                   body="Every visit is kept, so a slow improvement across a year is something you can actually show someone." />
            <Bento tone="#FFB27A" tint="lp-tint-peach" d={3}
                   title="It knows this terrain"
                   body="Slope is an input, not decoration. A model trained on flat-city knees does not know what terrace farming does to a joint." />
            <Bento className="wide" tone="#FF8FB0" tint="lp-tint-pink" d={4}
                   title="It ends with a person, not a number"
                   body="A raised risk comes back as one sentence someone can act on, the two exercises that help, and the nearest physiotherapist by road distance — plus someone whose job it is to check that the visit actually happened." />
          </div>
        </div>
      </section>

      {/* ====================================================== kit ======= */}
      <section id="kit" className="lp-band-tint" style={{ padding: "clamp(64px, 8vw, 100px) 0", scrollMarginTop: 30 }}>
        <div className="lp-wrap-wide">
          <div style={{ maxWidth: 780, marginBottom: 42 }}>
            <span className="lp-kicker lp-rise" style={{ color: "var(--blue)" }}>The kit</span>
            <h2 className="lp-h2 lp-rise" style={{ ["--d" as string]: 1, marginTop: 15 }}>
              Six parts. Nothing exotic.
            </h2>
            <p className="lp-lead lp-rise" style={{ ["--d" as string]: 2, marginTop: 20 }}>
              Every piece is something you can order today and a workshop in Guwahati can
              assemble. That is deliberate: a device that needs an imported part is a device
              that stops working the first time a district cannot get one.
            </p>
          </div>
          <KitSection />
        </div>
      </section>

      {/* =================================================== result ======= */}
      <section style={{ padding: "clamp(70px, 8.5vw, 108px) 0" }}>
        <div className="lp-wrap">
          <div style={{ maxWidth: 720, marginBottom: 40 }}>
            <span className="lp-kicker lp-rise" style={{ color: "var(--blue)" }}>What comes back</span>
            <h2 className="lp-h2 lp-rise" style={{ ["--d" as string]: 1, marginTop: 15 }}>
              One of three answers. Never a diagnosis.
            </h2>
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(266px, 1fr))" }}>
            <Band tone="#28B392" tint="lp-tint-mint" d={0} label="Green" head="Nothing to do today"
                  body="Knees are moving the way they should for this age and this kind of work. Come back in a year." />
            <Band tone="#D69100" tint="lp-tint-sun" d={1} label="Amber" head="Worth watching"
                  body="A few things sit outside the usual range. Here are two exercises, and we check again in three months." />
            <Band tone="#E1607F" tint="lp-tint-pink" d={2} label="Red" head="See a doctor"
                  body="Several signs point to real joint change. A slip is printed, and someone follows up that the visit happened." />
          </div>

          <div className="lp-card lp-rise" style={{ marginTop: 22, padding: "24px 28px", display: "flex", gap: 16, alignItems: "flex-start" }}>
            <span style={{
              width: 36, height: 36, flex: "0 0 36px", borderRadius: 13, display: "grid", placeItems: "center",
              background: "var(--sky-100)", color: "var(--blue-2)",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.4h.01" />
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 720, fontSize: 16.5 }}>This is a screening aid, not a diagnostic device.</div>
              <p className="lp-body" style={{ marginTop: 6 }}>
                It decides who should see a clinician sooner — nothing more. Nobody is told they
                have osteoarthritis by a phone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================== closing ====== */}
      <section id="impact" style={{ padding: "0 0 clamp(70px, 8.5vw, 110px)", scrollMarginTop: 30 }}>
        <div className="lp-wrap">
          <div className="lp-cta lp-scale">
            <div style={{ position: "relative", zIndex: 2 }}>
              <span className="lp-kicker" style={{ color: "var(--blue-2)" }}>Why the North-East</span>
              <h2 className="lp-h2" style={{ marginTop: 15, maxWidth: 780, marginInline: "auto" }}>
                Built for hills, terrace farms, and roads that wash out every monsoon.
              </h2>
              <p className="lp-lead" style={{ marginTop: 20, maxWidth: 620, marginInline: "auto" }}>
                Because the referral chain here is long, the screening has to happen where the
                person already stands — in the courtyard, at the camp, beside the field.
              </p>

              <div style={{
                display: "grid", gap: 26, gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                marginTop: 46, maxWidth: 820, marginInline: "auto",
              }}>
                <SoftStat to={32} label="districts modelled" />
                <SoftStat to={8} label="states in the region" />
                <SoftStat to={100} suffix="%" label="works offline" />
                <SoftStat to={17} label="languages" />
              </div>

              <div style={{ display: "flex", gap: 13, flexWrap: "wrap", justifyContent: "center", marginTop: 44 }}>
                <Link href={appHref} className="lp-btn lp-btn-primary">{appLabel}<ArrowIcon /></Link>
                <a href="#how" className="lp-btn lp-btn-soft">Read it again</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================== footer ======= */}
      <footer className="lp-footer">
        <div className="lp-wrap" style={{ display: "flex", gap: 30, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 350 }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.025em" }}>SANDHI</div>
            <p className="lp-small" style={{ marginTop: 10 }}>
              An early-warning check for knee osteoarthritis, made for health workers who work
              where the roads end. Smart India Hackathon 2026 · SIH26004 · MDoNER.
            </p>
          </div>
          <div style={{ display: "flex", gap: 46, flexWrap: "wrap" }}>
            <FootCol title="The project" links={[["Why it matters", "#problem"], ["How it works", "#how"], ["The kit", "#kit"]]} />
            <FootCol title="For workers" links={[["Sign in", "/login"], ["Why the North-East", "#impact"]]} />
          </div>
        </div>
        <div className="lp-wrap" style={{ marginTop: 36, paddingTop: 20, borderTop: "1px solid var(--edge)" }}>
          <p className="lp-small">
            Screening and triage support — not a diagnostic device. Designed and built in India.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ========================================================== pieces ======= */

function HeroStat({ to, suffix = "", label, zero }: { to?: number; suffix?: string; label: string; zero?: string }) {
  const { ref, value } = useCountUp(to ?? 0);
  return (
    <div>
      <div className="lp-num" style={{ fontSize: 31, fontWeight: 780, letterSpacing: "-.03em", lineHeight: 1, color: "var(--blue-3)" }}>
        <span ref={ref}>{zero ?? `${Math.round(value)}${suffix}`}</span>
      </div>
      <div className="lp-small" style={{ marginTop: 7 }}>{label}</div>
    </div>
  );
}

function BigStat({ to, suffix = "", head, body, tint, tone }: {
  to: number; suffix?: string; head: string; body: string; tint: string; tone: string;
}) {
  const { ref, value } = useCountUp<HTMLDivElement>(to);
  return (
    <GlowCard className={`lp-rise ${tint}`} tone={tone}>
      <div style={{ padding: "32px 30px 34px" }}>
        <div className="lp-num" ref={ref} style={{
          fontFamily: "var(--serif)", fontSize: "clamp(42px, 4.4vw, 56px)", fontWeight: 600,
          letterSpacing: "-.04em", lineHeight: 1, color: tone,
        }}>
          {Math.round(value)}{suffix}
        </div>
        <div style={{ fontWeight: 720, fontSize: 16.5, marginTop: 12 }}>{head}</div>
        <p className="lp-body" style={{ marginTop: 9, fontSize: 14.5 }}>{body}</p>
      </div>
    </GlowCard>
  );
}

function SoftStat({ to, suffix = "", label }: { to: number; suffix?: string; label: string }) {
  const { ref, value } = useCountUp<HTMLDivElement>(to);
  return (
    <div>
      <div ref={ref} className="lp-num" style={{
        fontFamily: "var(--serif)", fontSize: 42, fontWeight: 600, color: "var(--blue-3)",
        letterSpacing: "-.035em", lineHeight: 1,
      }}>
        {Math.round(value)}{suffix}
      </div>
      <div className="lp-small" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}

function Step({ n, title, body, tint, tone, icon, d }: {
  n: string; title: string; body: string; tint: string; tone: string; icon: React.ReactNode; d: number;
}) {
  return (
    <GlowCard className={`lp-rise ${tint}`} tone={tone} style={{ ["--d" as string]: d }}>
      <div className="lp-step">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{
            width: 52, height: 52, borderRadius: 18, display: "grid", placeItems: "center",
            background: "var(--card)", color: tone, boxShadow: "var(--soft)",
          }}>{icon}</span>
          <span className="lp-step-n" style={{ color: tone }}>{n}</span>
        </div>
        <h3 className="lp-h3" style={{ marginTop: 22 }}>{title}</h3>
        <p className="lp-body" style={{ marginTop: 11 }}>{body}</p>
      </div>
    </GlowCard>
  );
}

function Bento({ className = "", tone, tint, title, body, d, big }: {
  className?: string; tone: string; tint: string; title: string; body: string; d: number; big?: boolean;
}) {
  return (
    <GlowCard className={`lp-rise ${tint} ${className}`} tone={tone} style={{ ["--d" as string]: d }}>
      <div style={{ padding: big ? "34px 32px" : "26px 26px 28px", display: "flex", flexDirection: "column", height: "100%" }}>
        <span style={{
          width: 13, height: 13, borderRadius: 99, background: tone,
          boxShadow: `0 0 0 5px color-mix(in srgb, ${tone} 18%, transparent)`,
        }} />
        <h3 className="lp-h3" style={{ marginTop: 20, fontSize: big ? 25 : 19 }}>{title}</h3>
        <p className="lp-body" style={{ marginTop: 11, fontSize: big ? 15.4 : 14.4 }}>{body}</p>
      </div>
    </GlowCard>
  );
}

function Band({ tone, tint, label, head, body, d }: {
  tone: string; tint: string; label: string; head: string; body: string; d: number;
}) {
  return (
    <GlowCard className={`lp-rise ${tint}`} tone={tone} style={{ ["--d" as string]: d }}>
      <div style={{ padding: "28px 28px 30px" }}>
        <span className="lp-pill" style={{ color: tone }}>
          <span className="lp-dot" style={{ background: tone }} />{label}
        </span>
        <h3 className="lp-h3" style={{ marginTop: 18, fontSize: 20 }}>{head}</h3>
        <p className="lp-body" style={{ marginTop: 10, fontSize: 14.5 }}>{body}</p>
      </div>
    </GlowCard>
  );
}

function FootCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="lp-kicker" style={{ color: "var(--ink-3)", marginBottom: 13 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {links.map(([l, h]) => (
          <a key={l + h} href={h} style={{ fontSize: 14.5, color: "var(--ink-2)", fontWeight: 540 }}>{l}</a>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- glyphs */
const G = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function ArrowIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" {...G} aria-hidden><path d="M5 12h13M13 6.5 18.5 12 13 17.5" /></svg>; }
function StrapGlyph() { return <svg width="24" height="24" viewBox="0 0 24 24" {...G}><path d="M5 7c4.6-2.4 9.4-2.4 14 0M5 17c4.6 2.4 9.4 2.4 14 0" /><rect x="9" y="9" width="6" height="6" rx="2.4" /><path d="M12 3v3M12 18v3" /></svg>; }
function WalkGlyph() { return <svg width="24" height="24" viewBox="0 0 24 24" {...G}><circle cx="13" cy="4.5" r="2" /><path d="M11 21l2.5-6.5L11 11l1-4 3 2.5 3 1M11 11l-3 2.5L6.5 21" /></svg>; }
function ResultGlyph() { return <svg width="24" height="24" viewBox="0 0 24 24" {...G}><rect x="4" y="3" width="16" height="18" rx="3.4" /><path d="M8 9h8M8 13h5" /><path d="M8.5 17.2l1.6 1.6 3.4-3.4" /></svg>; }
