"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IcOverview, IcScreen, IcKit, IcDash, IcRegistry,
  IcWifi, IcWifiOff, IcSync, IcCheck,
} from "./Icons";
import { useSandhi } from "@/lib/store";
import { useI18n, LANGS } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Toggle } from "./ui";

const NAV = [
  { group: "nav.field", items: [
    { href: "/", label: "nav.overview", Icon: IcOverview },
    { href: "/screening", label: "nav.screening", Icon: IcScreen },
    { href: "/kit", label: "nav.kit", Icon: IcKit },
  ]},
  { group: "nav.programme", items: [
    { href: "/dashboard", label: "nav.dashboard", Icon: IcDash },
    { href: "/registry", label: "nav.registry", Icon: IcRegistry },
  ]},
];

function Mark() {
  const { t } = useI18n();
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
        <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: "#FFFFFF" }}>SANDHI</div>
        <div className="tiny" style={{ fontSize: 10.5, color: "var(--rail-text-3)" }}>{t("mark.tag")}</div>
      </div>
    </div>
  );
}

function RailContent() {
  const path = usePathname();
  const { t } = useI18n();
  const { online, setOnline, outbox, flush, syncing, serverUp, ready } = useSandhi();
  const pending = outbox.filter((o) => o.state !== "sent").length;
  return (
    <>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="eyebrow nav-group" style={{ color: "var(--rail-text-3)" }}>{t(g.group)}</div>
          {g.items.map(({ href, label, Icon }) => {
            const on = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-item ${on ? "on" : ""}`}>
                <Icon className="ico" />
                <span>{t(label)}</span>
                {href === "/screening" && pending > 0 && <span className="nav-badge">{pending}</span>}
              </Link>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <div className="card card-quiet" style={{ padding: "10px 11px", background: "rgba(255,255,255,.06)", borderColor: "var(--rail-border)" }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <span className="eyebrow" style={{ fontSize: 9.8, color: "var(--rail-text-3)" }}>{t("conn.title")}</span>
            <Toggle on={!online} onChange={(v) => setOnline(!v)} tone="warn" />
          </div>
          <div className="row" style={{ gap: 7, color: online ? "var(--sage-ink)" : "var(--amber-ink)" }}>
            {online ? <IcWifi size={14} /> : <IcWifiOff size={14} />}
            <span style={{ fontSize: 12.2, fontWeight: 600 }}>
              {online ? t("conn.up") : t("conn.off")}
            </span>
          </div>
          <div className="tiny" style={{ marginTop: 6, lineHeight: 1.45, color: "var(--rail-text-3)" }}>
            {online
              ? serverUp === true ? "Sync server reachable."
                : serverUp === false ? "Sync server not running — queue holds."
                : "Checking sync server…"
              : "Everything still works. Results queue locally."}
          </div>
        </div>

        <div className="row" style={{ gap: 7, marginTop: 9, justifyContent: "space-between" }}>
          <span className="tiny" style={{ color: "var(--rail-text-3)" }}>
            {t("outbox")} <span className="num" style={{ fontWeight: 620, color: pending ? "var(--amber-ink)" : "var(--rail-text-2)" }}>{pending}</span>
          </span>
          <button className="btn btn-sm btn-ghost" style={{ color: "var(--rail-text-2)" }} onClick={flush} disabled={!online || !pending || syncing}>
            {syncing ? <IcSync size={12} className="spin" /> : pending ? <IcSync size={12} /> : <IcCheck size={12} />}
            {syncing ? t("sync.syncing") : t("sync.title")}
          </button>
        </div>

        <div className="tiny" style={{ marginTop: 12, lineHeight: 1.5, paddingLeft: 2, color: "var(--rail-text-3)" }}>
          v0.4 · SIH26004<br />
          {ready ? "Model bundle loaded" : "Loading model…"}
        </div>
      </div>
    </>
  );
}

/* menu drawer state, shared between the Shell and page MenuButton/TopBar */
const MenuCtx = React.createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

export function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const toggle = React.useCallback(() => setMenuOpen((o) => !o), []);

  // body scroll lock + Escape while the drawer is open
  React.useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // focus management: move focus into the panel on open, restore on close
  const panelRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (menuOpen) {
      const first = panelRef.current?.querySelector<HTMLElement>("a,button");
      first?.focus();
    }
  }, [menuOpen]);

  const ctx = React.useMemo(() => ({ open: menuOpen, toggle }), [menuOpen, toggle]);

  return (
    <MenuCtx.Provider value={ctx}>
      <div className="app">
        <aside className="rail">
          <Mark />
          <RailContent />
        </aside>

        <div className="main">
          <div
            className={`DrawerOverlay ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen(false)}
            aria-hidden={!menuOpen}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            id="sandhi-drawer"
          >
            <div
              className="drawer-panel"
              ref={panelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="between" style={{ padding: "0 6px 10px" }}>
                <Mark />
                <button
                  className="btn btn-sm"
                  aria-label="Close navigation"
                  onClick={() => setMenuOpen(false)}
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <RailContent />
            </div>
          </div>
          {children}
        </div>
      </div>
    </MenuCtx.Provider>
  );
}

export function MenuButton() {
  const { open, toggle } = React.useContext(MenuCtx);
  return (
    <button
      className="btn btn-sm menubtn"
      aria-label={open ? "Close navigation" : "Open navigation"}
      aria-expanded={open}
      aria-controls="sandhi-drawer"
      onClick={toggle}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
      </svg>
    </button>
  );
}

export function TopBar({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  const { online, outbox } = useSandhi();
  const pending = outbox.filter((o) => o.state !== "sent").length;
  return (
    <div className="topbar">
      <MenuButton />
      <div className="grow row" style={{ gap: 10, minWidth: 0 }}>
        <span style={{ fontWeight: 600, fontSize: 13.6 }}>{title}</span>
      </div>
      <div className="row" style={{ gap: 9 }}>
        <ThemeToggle />
        <LangSelect />
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

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="btn btn-sm btn-ghost themebtn"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark"
        ? <IcSun size={15} />
        : <IcMoon size={15} />}
    </button>
  );
}

function LangSelect() {
  const { lang, setLang } = useI18n();
  return (
    <label className="langctl" title="Language">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M1.8 8h12.4M8 1.8c1.8 1.9 2.8 3.9 2.8 6.2S9.8 12.3 8 14.2M8 1.8C6.2 3.7 5.2 5.7 5.2 8s1 4.3 2.8 6.2" />
      </svg>
      <select
        className="select select-xs"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label="Language"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>{l.name}</option>
        ))}
      </select>
    </label>
  );
}

function IcSun({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="8" cy="8" r="3.4" />
      <path d="M8 1.2v1.6M8 13.2v1.6M1.2 8h1.6M13.2 8h1.6M3 3l1.1 1.1M11.9 11.9 13 13M13 3l-1.1 1.1M4.1 11.9 3 13" />
    </svg>
  );
}

function IcMoon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13.5 9.2A5.7 5.7 0 1 1 6.8 2.5a4.6 4.6 0 0 0 6.7 6.7Z" />
    </svg>
  );
}