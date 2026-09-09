"use client";
/**
 * Motion primitives for the landing page.
 *
 * Everything here writes CSS custom properties on an element and lets CSS do
 * the painting — no per-frame React state, so a scroll or a mouse move never
 * triggers a re-render. Pointer and scroll work is coalesced into one
 * requestAnimationFrame, and every hook no-ops under prefers-reduced-motion.
 */
import * as React from "react";

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cursor-tracking glow: sets --mx/--my (px, element-relative) and --glow (0→1). */
export function useMouseGlow<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let x = 0, y = 0;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onEnter = () => el.style.setProperty("--glow", "1");
    const onLeave = () => el.style.setProperty("--glow", "0");

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}

/** Perspective tilt toward the cursor: sets --rx/--ry in degrees. */
export function useTilt<T extends HTMLElement>(max = 9) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let rx = 0, ry = 0;

    const paint = () => {
      frame = 0;
      el.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      ry = px * max * 2;
      rx = -py * max * 2;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [max]);

  return ref;
}

/** How far the element has been scrolled through, 0 → 1, on --fill. */
export function useFillProgress<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = r.height + vh * 0.5;
      const done = vh * 0.75 - r.top;
      el.style.setProperty("--fill", String(Math.max(0, Math.min(1, done / total))));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return ref;
}

/** Magnetic pull toward the cursor for a button. */
export function useMagnetic<T extends HTMLElement>(strength = 0.28) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let dx = 0, dy = 0;
    const paint = () => {
      frame = 0;
      el.style.setProperty("--tx", `${dx.toFixed(1)}px`);
      el.style.setProperty("--ty", `${dy.toFixed(1)}px`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      dx = (e.clientX - (r.left + r.width / 2)) * strength;
      dy = (e.clientY - (r.top + r.height / 2)) * strength;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0;
      el.style.setProperty("--tx", "0px");
      el.style.setProperty("--ty", "0px");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, [strength]);

  return ref;
}
