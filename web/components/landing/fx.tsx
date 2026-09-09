"use client";
/**
 * The landing page's effect kit — soft-focus versions of the modern set:
 * a colour wash, drifting sparkles, cursor-lit cards, gentle 3D tilt, a
 * tracing beam and word reveals. Plain React + CSS custom properties, so the
 * page carries no animation library.
 */
import * as React from "react";
import { useMouseGlow, useTilt, useFillProgress, useMagnetic } from "@/lib/useScrollFx";

/* ------------------------------------------------------------- backdrops -- */

/** Big out-of-focus colour drifting behind the page. */
export function Wash() {
  return (
    <div className="lp-wash" aria-hidden>
      <i /><i /><i /><i />
    </div>
  );
}

/** A scatter of small twinkling dots. Deterministic, so SSR and client agree. */
export function Sparkles({ count = 18 }: { count?: number }) {
  const dots = React.useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: (i * 41 + 7) % 100,
      top: (i * 29 + 11) % 100,
      size: 3 + (i % 3) * 1.6,
      delay: -(i * 0.9) % 7,
      dur: 4.5 + (i % 4),
    })),
    [count]
  );
  return (
    <div className="lp-sparkles" aria-hidden>
      {dots.map((d, i) => (
        <span key={i} style={{
          left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size,
          animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s`,
        }} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- cards -- */

/** A card that lights up softly under the cursor and lifts a little. */
export function GlowCard({ className = "", children, style, tone = "#4A9EFF" }: {
  className?: string; children: React.ReactNode; style?: React.CSSProperties; tone?: string;
}) {
  const ref = useMouseGlow<HTMLDivElement>();
  return (
    <div ref={ref} className={`fx-glow-card ${className}`} style={{ ["--tone" as string]: tone, ...style }}>
      <span className="fx-glow-layer" aria-hidden />
      <div className="fx-glow-body">{children}</div>
    </div>
  );
}

/** Gentle cursor tilt. */
export function TiltCard({ className = "", children, style, max = 6 }: {
  className?: string; children: React.ReactNode; style?: React.CSSProperties; max?: number;
}) {
  const ref = useTilt<HTMLDivElement>(max);
  return (
    <div className="fx-tilt-wrap" style={style}>
      <div ref={ref} className={`fx-tilt ${className}`}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- scroll -- */

/** A beam that fills as the section scrolls past. */
export function TracingBeam({ children }: { children: React.ReactNode }) {
  const ref = useFillProgress<HTMLDivElement>();
  return (
    <div ref={ref} className="fx-trace">
      <div className="fx-trace-rail" aria-hidden>
        <span className="fx-trace-fill" />
        <span className="fx-trace-head" />
      </div>
      <div className="fx-trace-body">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ text -- */

/**
 * Words arrive one at a time, out of a blur. The sentence is fully present in
 * the markup, so it reads normally for search and screen readers whether or
 * not the animation runs.
 *
 * Never nest this inside a `background-clip: text` element — the clip does not
 * follow into inline-block descendants and the words come out invisible. Use a
 * plain gradient span for those.
 */
export function WordReveal({ text, className = "", delay = 0, style }: {
  text: string; className?: string; delay?: number; style?: React.CSSProperties;
}) {
  const words = text.split(" ");
  return (
    <span className={`fx-words ${className}`} style={style}>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="fx-word" style={{ animationDelay: `${delay + i * 0.055}s` }}>
          {w}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

/** A rotating word in a fixed slot. */
export function FlipWords({ words, interval = 2300 }: { words: string[]; interval?: number }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(id);
  }, [words.length, interval]);
  return (
    <span className="fx-flip">
      <span key={i} className="fx-flip-word">{words[i]}</span>
    </span>
  );
}

/** A hand-drawn underline that draws itself in. */
export function Squiggle({ width = 190 }: { width?: number }) {
  return (
    <svg className="lp-squiggle" width={width} height="12" viewBox="0 0 190 12" fill="none" aria-hidden>
      <path d="M3 8.5C28 3.5 52 3 76 6.5c24 3.5 48 4 68-2.5"
            stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------------------------------------------- buttons -- */

/** Primary call to action, with a light magnetic pull toward the cursor. */
export function MagneticButton({ children, href, className = "" }: {
  children: React.ReactNode; href: string; className?: string;
}) {
  const ref = useMagnetic<HTMLAnchorElement>(0.2);
  return <a ref={ref} href={href} className={`lp-btn ${className}`}>{children}</a>;
}
