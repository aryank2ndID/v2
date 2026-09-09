"use client";
/**
 * The hero picture: a soft, friendly scene of someone walking with the two
 * little sensors on their leg. Rounded shapes, pastel blues, gentle bob —
 * it should read as reassuring, not clinical.
 */
import * as React from "react";

export function GaitStage() {
  return (
    <div className="lp-scene">
      <div className="lp-scene-dots" aria-hidden />

      <svg viewBox="0 0 420 340" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden>
        <defs>
          {/* userSpaceOnUse: these strokes are vertical, and a bounding-box
              gradient on a zero-width box would not paint at all. */}
          <linearGradient id="legNear" gradientUnits="userSpaceOnUse" x1="196" y1="150" x2="240" y2="276">
            <stop offset="0" stopColor="#6FB4FF" />
            <stop offset="1" stopColor="#4A9EFF" />
          </linearGradient>
          <linearGradient id="legFar" gradientUnits="userSpaceOnUse" x1="196" y1="150" x2="240" y2="276">
            <stop offset="0" stopColor="#BFDCFF" />
            <stop offset="1" stopColor="#A8CEFF" />
          </linearGradient>
          <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6FE0C0" stopOpacity=".5" />
            <stop offset="1" stopColor="#6FE0C0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* soft ground shadow */}
        <ellipse cx="210" cy="276" rx="86" ry="9" fill="#4A9EFF" opacity=".13" />

        {/* floating friendly shapes */}
        <circle cx="82" cy="70" r="16" fill="#BFE3FF" opacity=".8" />
        <circle cx="344" cy="104" r="11" fill="#C9F3E6" opacity=".9" />
        <circle cx="316" cy="52" r="7" fill="#D9CDFF" opacity=".9" />
        <circle cx="66" cy="196" r="9" fill="#FFE0C7" opacity=".85" />

        <g className="lp-walk">
          {/* head with a small smile — the cute bit */}
          <circle cx="210" cy="60" r="27" fill="#fff" stroke="#CBDDF1" strokeWidth="2.5" />
          <circle cx="201" cy="57" r="2.6" fill="#14314D" />
          <circle cx="219" cy="57" r="2.6" fill="#14314D" />
          <path d="M203 68q7 6 14 0" stroke="#14314D" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <circle cx="194" cy="65" r="4" fill="#FFAFC8" opacity=".65" />
          <circle cx="226" cy="65" r="4" fill="#FFAFC8" opacity=".65" />

          {/* rounded body */}
          <rect x="188" y="90" width="44" height="66" rx="22" fill="#fff" stroke="#CBDDF1" strokeWidth="2.5" />

          {/* arms */}
          <g style={{ transformOrigin: "210px 106px" }} className="lp-thigh-b">
            <path d="M192 106 L176 146" stroke="#BFDCFF" strokeWidth="11" strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: "210px 106px" }} className="lp-thigh">
            <path d="M228 106 L244 146" stroke="#BFDCFF" strokeWidth="11" strokeLinecap="round" />
          </g>

          {/* far leg — nudged back and left so the two legs read separately */}
          <g transform="translate(-10 0)">
            <g style={{ transformOrigin: "210px 156px" }} className="lp-thigh-b">
              <path d="M210 156 L210 214" stroke="url(#legFar)" strokeWidth="15" strokeLinecap="round" />
              <g style={{ transformOrigin: "210px 214px" }} className="lp-shin-b">
                <path d="M210 214 L210 266" stroke="url(#legFar)" strokeWidth="13" strokeLinecap="round" />
                <ellipse cx="215" cy="270" rx="15" ry="7.5" fill="#BFDCFF" />
              </g>
            </g>
          </g>

          {/* near leg — the measured one */}
          <g style={{ transformOrigin: "210px 156px" }} className="lp-thigh">
            <path d="M210 156 L210 214" stroke="url(#legNear)" strokeWidth="17" strokeLinecap="round" />

            {/* sensor band, above the knee */}
            <rect x="192" y="174" width="36" height="17" rx="8.5" fill="#fff" stroke="#4A9EFF" strokeWidth="2.6" />
            <circle className="lp-ping-node" cx="210" cy="182.5" r="4.4" fill="#4A9EFF" />

            <g style={{ transformOrigin: "210px 214px" }} className="lp-shin">
              <path d="M210 214 L210 266" stroke="url(#legNear)" strokeWidth="15" strokeLinecap="round" />

              {/* sensor band, below the knee */}
              <rect x="193" y="232" width="34" height="16" rx="8" fill="#fff" stroke="#6FE0C0" strokeWidth="2.6" />
              <circle className="lp-ping-node" cx="210" cy="240" r="4.2" fill="#3FCDA6" />

              <ellipse cx="216" cy="270" rx="16" ry="8" fill="#4A9EFF" />
            </g>

            {/* the knee itself */}
            <circle cx="210" cy="214" r="11" fill="#fff" stroke="#4A9EFF" strokeWidth="3" />
          </g>
        </g>

        {/* the gentle signal those sensors make */}
        <g transform="translate(0, 292)">
          <path
            d="M0 26 C 22 26, 28 8, 44 8 S 64 38, 82 38 S 98 12, 116 12 S 136 36, 154 36
               S 170 6, 188 6 S 208 38, 226 38 S 242 10, 260 10 S 280 36, 298 36
               S 314 8, 332 8 S 352 38, 370 38 S 386 14, 404 14 L420 24"
            fill="none" stroke="#6FE0C0" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M0 26 C 22 26, 28 8, 44 8 S 64 38, 82 38 S 98 12, 116 12 S 136 36, 154 36
               S 170 6, 188 6 S 208 38, 226 38 S 242 10, 260 10 S 280 36, 298 36
               S 314 8, 332 8 S 352 38, 370 38 S 386 14, 404 14 L420 24 L420 52 L0 52 Z"
            fill="url(#waveFill)" />
        </g>
      </svg>

      <Chip style={{ left: "5%", top: "13%" }} tone="#4A9EFF" k="Sensor 1" v="above the knee" delay="0s" />
      <Chip style={{ right: "4%", top: "43%" }} tone="#3FCDA6" k="Sensor 2" v="below the knee" delay="-2s" />
      <Chip style={{ left: "6%", bottom: "8%" }} tone="#B7A8FF" k="Reading" v="100× a second" delay="-3.6s" />
    </div>
  );
}

function Chip({ style, tone, k, v, delay }: {
  style: React.CSSProperties; tone: string; k: string; v: string; delay: string;
}) {
  return (
    <div className="lp-chip" style={{ animationDelay: delay, ...style }}>
      <span style={{
        width: 9, height: 9, borderRadius: 99, background: tone, flex: "0 0 9px",
        boxShadow: `0 0 0 4px color-mix(in srgb, ${tone} 18%, transparent)`,
      }} />
      <span style={{ lineHeight: 1.25 }}>
        <span style={{ display: "block", fontSize: 10, fontWeight: 750, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>{k}</span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 660, color: "var(--ink)" }}>{v}</span>
      </span>
    </div>
  );
}
