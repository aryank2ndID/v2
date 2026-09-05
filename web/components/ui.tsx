"use client";
import * as React from "react";

export function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function CardHead({ title, sub, right, icon }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card-hd">
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        {icon && <span style={{ color: "var(--ink-3)", display: "flex" }}>{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <h3>{title}</h3>
          {sub && <div className="tiny dim" style={{ marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Chip({ tone = "", children, style }: { tone?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className={`chip ${tone}`} style={style}>{children}</span>;
}

export function Stat({ label, value, unit, sub, tone, trend }: {
  label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode;
  tone?: string; trend?: React.ReactNode;
}) {
  return (
    <div className="card card-pad" style={{ background: tone ?? "var(--surface)" }}>
      <div className="eyebrow">{label}</div>
      <div className="row" style={{ gap: 6, alignItems: "baseline", marginTop: 8 }}>
        <span className="serif num" style={{ fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</span>
        {unit && <span className="small dim" style={{ fontWeight: 500 }}>{unit}</span>}
        {trend}
      </div>
      {sub && <div className="tiny dim" style={{ marginTop: 8, lineHeight: 1.5 }}>{sub}</div>}
    </div>
  );
}

export function Bar({ value, tone = "var(--sky-line)", height = 6 }: { value: number; tone?: string; height?: number }) {
  return (
    <div className="bar-track" style={{ height }}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: tone }} />
    </div>
  );
}

export function KV({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="kv"><dt>{k}</dt><dd>{v}</dd></div>
  );
}

export function Toggle({ on, onChange, tone }: { on: boolean; onChange: (v: boolean) => void; tone?: "warn" }) {
  return (
    <button
      className={`toggle ${on ? "on" : ""} ${tone === "warn" && on ? "warn" : ""}`}
      onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{ padding: 0 }}
    />
  );
}

/** The one component that must never be removed: it marks fabricated data. */
export function SimBadge({ what, why, compact }: { what: string; why?: string; compact?: boolean }) {
  if (compact) {
    return (
      <span className="chip chip-amber" title={why}>
        <span className="dot" />SIMULATED
      </span>
    );
  }
  return (
    <div style={{
      display: "flex", gap: 10, padding: "9px 12px", borderRadius: "var(--r-sm)",
      background: "var(--amber-bg)", border: "1px solid var(--amber-line)",
      color: "var(--amber-ink)", alignItems: "flex-start",
    }}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ marginTop: 1.5, flex: "0 0 14px" }}>
        <circle cx="8" cy="8" r="6.3" /><path d="M8 5v3.6M8 11h.01" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: 12.3, lineHeight: 1.5 }}>
        <strong style={{ fontWeight: 600 }}>{what}</strong>
        {why && <span> — {why}</span>}
      </div>
    </div>
  );
}

export function Section({ title, sub, right, children }: {
  title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 30 }}>
      <div className="between" style={{ marginBottom: 14, gap: 16 }}>
        <div>
          <h2>{title}</h2>
          {sub && <div className="small dim" style={{ marginTop: 4, maxWidth: 720, lineHeight: 1.55 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function PageHead({ eyebrow, title, lead, right }: {
  eyebrow: string; title: string; lead?: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <header className="between" style={{ gap: 28, alignItems: "flex-start", marginBottom: 24 }}>
      <div style={{ minWidth: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>
        <h1 className="serif">{title}</h1>
        {lead && <p className="muted" style={{ marginTop: 10, maxWidth: 780, fontSize: 14.5, lineHeight: 1.65 }}>{lead}</p>}
      </div>
      {right && <div style={{ flex: "0 0 auto" }}>{right}</div>}
    </header>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="card card-quiet" style={{
      padding: "34px 20px", textAlign: "center", color: "var(--ink-3)", fontSize: 13,
    }}>{children}</div>
  );
}

export function Skeleton({ h = 90 }: { h?: number }) {
  return (
    <div className="card" style={{
      height: h,
      background: "linear-gradient(100deg, var(--surface-2) 30%, var(--surface-3) 50%, var(--surface-2) 70%)",
      backgroundSize: "220% 100%", animation: "shimmer 1.5s linear infinite", border: "1px solid var(--line-soft)",
    }}>
      <style>{`@keyframes shimmer{from{background-position:150% 0}to{background-position:-50% 0}}`}</style>
    </div>
  );
}
