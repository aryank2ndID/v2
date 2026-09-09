"use client";
/** Scroll choreography for the landing page: reveal-on-enter and count-up.
    IntersectionObserver rather than scroll-driven CSS animations, because
    these have to fire once and stay put on every browser, not just the ones
    that shipped animation-timeline. */
import * as React from "react";

/** Marks a container's `.lp-rise` / `.lp-scale` children as seen, once. */
export function useReveal<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  // Arming lives in React state, not a raw setAttribute, so a re-render of the
  // root element cannot quietly drop it and leave the page hidden.
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(".lp-rise, .lp-scale");
    if (!targets.length || !("IntersectionObserver" in window)) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).setAttribute("data-seen", "true");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return { ref, armed };
}

/** Counts from 0 to `to` the first time the element scrolls into view. */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(to: number, duration = 1400) {
  const ref = React.useRef<T>(null);
  const [value, setValue] = React.useState(0);
  const done = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return;

    const run = () => {
      done.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(to); return; }
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        // ease-out-expo: fast start, soft landing
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        setValue(to * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (!("IntersectionObserver" in window)) { setValue(to); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return { ref, value };
}
