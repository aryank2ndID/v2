"use client";
import * as React from "react";

/**
 * USP 2 — the Make in India mark.
 *
 * Drawn rather than imported: the field bundle ships no raster assets it does
 * not need, and an SVG tricolour stays crisp on a 5-inch screen and on the
 * printed referral slip.
 */
export function MakeInIndia({ dark }: { dark?: boolean } = {}) {
  const ink = dark ? "var(--ink-2)" : "rgba(255,255,255,.75)";
  return (
    <span title="Designed and manufactured in India" style={{
      display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px 5px 8px",
      borderRadius: 99, border: `1px solid ${dark ? "var(--line-strong)" : "rgba(255,255,255,.18)"}`,
      background: dark ? "var(--surface-2)" : "rgba(255,255,255,.06)",
      fontSize: 11, fontWeight: 650, letterSpacing: ".01em", color: ink, whiteSpace: "nowrap",
    }}>
      <svg width="17" height="12" viewBox="0 0 21 14" aria-hidden>
        <rect width="21" height="4.66" y="0" fill="#FF9933" />
        <rect y="4.66" width="21" height="4.66" fill="#FFFFFF" />
        <rect y="9.32" width="21" height="4.66" fill="#138808" />
        <circle cx="10.5" cy="7" r="1.7" fill="none" stroke="#0A3B8C" strokeWidth=".7" />
      </svg>
      Make in India
    </span>
  );
}
