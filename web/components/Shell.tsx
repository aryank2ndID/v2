"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IcOverview, IcScreen, IcKit, IcDash, IcRegistry, IcModel, IcSystem,
  IcWifi, IcWifiOff, IcSync, IcCheck,
} from "./Icons";
import { useSandhi } from "@/lib/store";
import { Toggle } from "./ui";

const NAV = [
  { group: "Field", items: [
    { href: "/", label: "Overview", Icon: IcOverview },
    { href: "/screening", label: "Screening", Icon: IcScreen },
    { href: "/kit", label: "Kit console", Icon: IcKit },
  ]},
  { group: "Programme", items: [
    { href: "/dashboard", label: "District dashboard", Icon: IcDash },
    { href: "/registry", label: "Registry", Icon: IcRegistry },
  ]},
  { group: "Evidence", items: [
    { href: "/model", label: "Model card", Icon: IcModel },
    { href: "/system", label: "System & reality map", Icon: IcSystem },
  ]},
];

function Mark() {
  return (
    <div className="row" style={{ gap: 9, padding: "2px 10px 12px" }}>
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
        <rect width="28" height="28" rx="8" fill="var(--sky-bg)" stroke="var(--sky-line)" />
        {/* a knee joint in profile: femur, tibia, and the joint line between */}
        <path d="M9 6.5v6.2c0 1.6 1.2 2.6 2.6 3.1" stroke="var(--sky-ink)" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M19 21.5v-5.6c0-1.7-1.3-2.7-2.8-3.2" stroke="var(--sky-ink)" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M10.4 14.2c2.6 1.9 5 2.2 7.4.6" stroke="var(--clay-ink)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.6 2" />
      </svg>
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontWeight: 640, fontSize: 14.5, letterSpacing: "-0.02em" }}>SANDHI</div>
        <div className="tiny dim" style={{ fontSize: 10.5 }}>Knee screening · NER</div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { online, setOnline, outbox, flush, syncing, serverUp, ready } = useSandhi();
  const pending = outbox.filter((o) => o.state !== "sent").length;

  return (
    <div className="app">
      <aside className="rail">
        <Mark />
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="eyebrow nav-group">{g.group}</div>
            {g.items.map(({ href, label, Icon }) => {
              const on = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link key={href} href={href} className={`nav-item ${on ? "on" : ""}`}>
                  <Icon className="ico" />
                  <span>{label}</span>
                  {href === "/screening" && pending > 0 && <span className="nav-badge">{pending}</span>}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <div className="card card-quiet" style={{ padding: "10px 11px" }}>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="eyebrow" style={{ fontSize: 9.8 }}>Connectivity</span>
              <Toggle on={!online} onChange={(v) => setOnline(!v)} tone="warn" />
            </div>
            <div className="row" style={{ gap: 7, color: online ? "var(--sage-ink)" : "var(--amber-ink)" }}>
              {online ? <IcWifi size={14} /> : <IcWifiOff size={14} />}
              <span style={{ fontSize: 12.2, fontWeight: 560 }}>
                {online ? "Network up" : "Airplane mode"}
              </span>
            </div>
            <div className="tiny dim" style={{ marginTop: 6, lineHeight: 1.45 }}>
              {online
                ? serverUp === true ? "Sync server reachable."
                  : serverUp === false ? "Sync server not running — queue holds."
                  : "Checking sync server…"
                : "Everything still works. Results queue locally."}
            </div>
          </div>

          <div className="row" style={{ gap: 7, marginTop: 9, justifyContent: "space-between" }}>
            <span className="tiny dim">
              Outbox <span className="num" style={{ fontWeight: 620, color: pending ? "var(--amber-ink)" : "var(--ink-3)" }}>{pending}</span>
            </span>
            <button className="btn btn-sm btn-ghost" onClick={flush} disabled={!online || !pending || syncing}>
              {syncing ? <IcSync size={12} className="spin" /> : pending ? <IcSync size={12} /> : <IcCheck size={12} />}
              {syncing ? "Syncing" : "Sync"}
            </button>
          </div>

          <div className="tiny faint" style={{ marginTop: 12, lineHeight: 1.5, paddingLeft: 2 }}>
            v0.4 · SIH26004<br />
            {ready ? "Model bundle loaded" : "Loading model…"}
          </div>
        </div>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}

export function TopBar({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  const { online, outbox } = useSandhi();
  const pending = outbox.filter((o) => o.state !== "sent").length;
  return (
    <div className="topbar">
      <div className="grow row" style={{ gap: 10, minWidth: 0 }}>
        <span style={{ fontWeight: 570, fontSize: 13.6 }}>{title}</span>
      </div>
      <div className="row" style={{ gap: 9 }}>
        {right}
        {!online && (
          <span className="chip chip-amber"><IcWifiOff size={11} />Offline</span>
        )}
        {pending > 0 && (
          <span className="chip"><span className="num">{pending}</span> queued</span>
        )}
      </div>
    </div>
  );
}
