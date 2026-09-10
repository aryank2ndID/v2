"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, ROLE_HOME, ROLE_LABEL, SEED_ACCOUNTS } from "@/lib/auth";
import { IcCheck, IcArrow, IcAlert, IcPin, IcUser, IcHeart } from "@/components/Icons";
import { MakeInIndia } from "@/components/Brand";
import { Tabs } from "@/components/Segmented";

type Mode = "in" | "up";

const DISTRICTS = [
  { id: "AS-JOR", name: "Jorhat, Assam" },
  { id: "AS-KAM", name: "Kamrup Metropolitan, Assam" },
  { id: "AS-DIB", name: "Dibrugarh, Assam" },
  { id: "AS-CAC", name: "Cachar, Assam" },
  { id: "ML-EKH", name: "East Khasi Hills, Meghalaya" },
  { id: "MN-IMW", name: "Imphal West, Manipur" },
  { id: "NL-KOH", name: "Kohima, Nagaland" },
  { id: "AR-PAP", name: "Papum Pare, Arunachal Pradesh" },
  { id: "TR-WTR", name: "West Tripura, Tripura" },
  { id: "MZ-AIZ", name: "Aizawl, Mizoram" },
  { id: "SK-GAN", name: "Gangtok, Sikkim" },
];

export default function LoginPage() {
  const router = useRouter();
  const { session, loaded, signIn, signUp } = useAuth();
  const [mode, setMode] = React.useState<Mode>("in");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  // Already signed in? Go straight to that role's home.
  React.useEffect(() => {
    if (loaded && session) router.replace(ROLE_HOME[session.role]);
  }, [loaded, session, router]);

  const go = (r: { ok: true; role: "admin" | "volunteer" | "user" } | { ok: false; error: string }) => {
    if (!r.ok) { setError(r.error); setBusy(false); return; }
    setError("");
    router.push(ROLE_HOME[r.role]);
  };

  const onSignIn = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    go(signIn(String(f.get("username") ?? ""), String(f.get("password") ?? "")));
  };

  const onSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    go(signUp({
      username: String(f.get("username") ?? ""),
      password: String(f.get("new-password") ?? ""),
      name: String(f.get("name") ?? ""),
      district: String(f.get("district") ?? "AS-JOR"),
      phone: String(f.get("phone") ?? ""),
    }));
  };

  const switchTo = (m: Mode) => { setMode(m); setError(""); setBusy(false); };

  return (
    <div className="auth">
      <Aside />

      <div className="auth-panel">
        <div className="auth-card enter">
          <Link href="/" className="row" style={{ gap: 8, marginBottom: 26, color: "var(--ink-3)", fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ rotate: "180deg", display: "flex" }}><IcArrow size={13} /></span>
            Back to overview
          </Link>

          <h1 className="serif" style={{ fontSize: 30, letterSpacing: "-0.03em" }}>
            {mode === "in" ? "Welcome back" : "Join the programme"}
          </h1>
          <p className="dim" style={{ marginTop: 8, fontSize: 13.6, lineHeight: 1.55 }}>
            {mode === "in"
              ? "Sign in to screen yourself, run screenings, or open the district console."
              : "New accounts get their own screening console — for checking your own knees."}
          </p>

          <div style={{ marginTop: 22 }} className="seg-full">
            <Tabs
              label="Sign in or create an account"
              value={mode}
              onChange={switchTo}
              items={[{ id: "in", label: "Sign in" }, { id: "up", label: "Create account" }]}
            />
          </div>

          {error && (
            <div className="enter row" style={{
              gap: 9, marginTop: 18, padding: "11px 13px", borderRadius: "var(--r-sm)",
              background: "var(--error-bg)", border: "1px solid color-mix(in srgb, var(--error) 32%, transparent)",
              color: "var(--error)", fontSize: 12.8, lineHeight: 1.45,
            }} role="alert">
              <IcAlert size={15} />{error}
            </div>
          )}

          {mode === "in"
            ? <SignInForm onSubmit={onSignIn} busy={busy} />
            : <SignUpForm onSubmit={onSignUp} busy={busy} />}

          {mode === "in" && <DemoKeys onPick={(u, p) => { setBusy(true); go(signIn(u, p)); }} />}

          <p className="tiny dim" style={{ marginTop: 22, lineHeight: 1.6, textAlign: "center" }}>
            Screening and triage support — not a diagnostic device.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ sign in ---- */

function SignInForm({ onSubmit, busy }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 20, display: "grid", gap: 15 }}>
      <div className="field">
        <label className="label" htmlFor="username">Username</label>
        <input
          className="input" type="text" id="username" name="username"
          autoComplete="username" required autoFocus
          enterKeyHint="next" autoCapitalize="none" spellCheck={false}
          placeholder="admin"
        />
      </div>

      <PasswordField
        id="current-password" name="password" label="Password"
        autoComplete="current-password" enterKeyHint="done"
      />

      <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------ sign up ---- */

function SignUpForm({ onSubmit, busy }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 20, display: "grid", gap: 15 }}>
      <div className="field">
        <label className="label" htmlFor="name">Full name</label>
        <input
          className="input" type="text" id="name" name="name"
          autoComplete="name" required autoFocus enterKeyHint="next"
          placeholder="Anjali Kalita"
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="signup-username">Username</label>
        <input
          className="input" type="text" id="signup-username" name="username"
          autoComplete="username" required minLength={2} enterKeyHint="next"
          autoCapitalize="none" spellCheck={false} placeholder="anjali"
          aria-errormessage="username-err"
        />
        <span className="err" id="username-err"><IcAlert size={13} />At least 2 characters, no spaces.</span>
      </div>

      <PasswordField
        id="new-password" name="new-password" label="Password"
        autoComplete="new-password" enterKeyHint="next" minLength={2}
        hint="Any 2 characters or more."
      />

      <div className="field">
        <label className="label" htmlFor="district">Your district</label>
        <select className="select" id="district" name="district" defaultValue="AS-JOR" required>
          {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="hint">Used to show the nearest physiotherapist and hospital.</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="phone">Mobile number</label>
        <input
          className="input" type="tel" id="phone" name="phone"
          autoComplete="tel" inputMode="tel" required enterKeyHint="done"
          pattern="[0-9+\s-]{10,16}" placeholder="+91 98640 00000"
          aria-errormessage="phone-err"
        />
        <span className="err" id="phone-err"><IcAlert size={13} />Enter a 10-digit mobile number.</span>
      </div>

      <button className="btn btn-primary btn-lg" type="submit" disabled={busy} style={{ marginTop: 4 }}>
        {busy ? "Creating…" : "Create my account"}
      </button>
      <p className="tiny dim" style={{ lineHeight: 1.55 }}>
        This creates a patient account for screening yourself. Volunteer and admin access are
        issued by the programme office, not self-served.
      </p>
    </form>
  );
}

/* Password input with a show/hide toggle — people mistype on a phone, in
   sunlight, with one hand. Letting them look is worth more than the secrecy. */
function PasswordField({ id, name, label, autoComplete, enterKeyHint, minLength, hint }: {
  id: string; name: string; label: string;
  autoComplete: "current-password" | "new-password";
  enterKeyHint: "next" | "done"; minLength?: number; hint?: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="field">
      <div className="between">
        <label className="label" htmlFor={id}>{label}</label>
        {hint && <span className="tiny dim">{hint}</span>}
      </div>
      <div className="pw-wrap">
        <input
          className="input" id={id} name={name} required
          type={show ? "text" : "password"}
          autoComplete={autoComplete} enterKeyHint={enterKeyHint}
          minLength={minLength} autoCapitalize="none" spellCheck={false}
        />
        <button
          type="button" className="pw-eye" onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        >
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}

const Eye = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
    <path d="M1.4 8S4 3.6 8 3.6 14.6 8 14.6 8 12 12.4 8 12.4 1.4 8 1.4 8Z" /><circle cx="8" cy="8" r="2.1" />
  </svg>
);
const EyeOff = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
    <path d="M6.4 3.9A6.6 6.6 0 0 1 8 3.7c4 0 6.6 4.3 6.6 4.3a13 13 0 0 1-2 2.5M4 4.9A12.6 12.6 0 0 0 1.4 8S4 12.3 8 12.3c.8 0 1.5-.2 2.2-.4" />
    <path d="M2.2 2.2l11.6 11.6" />
  </svg>
);

/* One tap into either role. This is a demo build; asking a judge to type
   "admin" twice is friction with no upside. */
function DemoKeys({ onPick }: { onPick: (u: string, p: string) => void }) {
  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed var(--line)" }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Demo access</div>
      <div className="grid g3" style={{ gap: 10 }}>
        {SEED_ACCOUNTS.map((a) => (
          <button key={a.username} className="tile tap" style={{ minHeight: 0, padding: 13, gap: 8 }}
                  onClick={() => onPick(a.username, a.password)}>
            <div className="row" style={{ gap: 9 }}>
              <span className="tile-ic" style={{ width: 30, height: 30, flexBasis: 30, borderRadius: 10 }}>
                {a.role === "admin" ? <IcPin size={15} /> : a.role === "volunteer" ? <IcUser size={15} /> : <IcHeart size={15} />}
              </span>
              <span className="tile-t" style={{ fontSize: 13.4 }}>
                {ROLE_LABEL[a.role]}
              </span>
            </div>
            <span className="mono dim" style={{ fontSize: 11.4 }}>{a.username} / {a.password}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- the aside --- */

function Aside() {
  return (
    <aside className="auth-aside">
      <div className="row" style={{ gap: 10 }}>
        <Logo />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>SANDHI</div>
          <div style={{ fontSize: 10.6, color: "rgba(255,255,255,.5)" }}>Knee screening · North-East</div>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 400 }}>
        <h2 className="serif" style={{ fontSize: 34, lineHeight: 1.16, letterSpacing: "-0.03em", color: "#fff" }}>
          Three minutes.<br />One strap.<br />No signal needed.
        </h2>
        <ul style={{ listStyle: "none", margin: "26px 0 0", padding: 0, display: "grid", gap: 13 }}>
          {[
            "Screen a village for early knee OA",
            "Results and guidance work offline",
            "Syncs to the district when there's a bar",
          ].map((line) => (
            <li key={line} className="row" style={{ gap: 10, color: "rgba(255,255,255,.82)", fontSize: 13.6 }}>
              <span style={{
                width: 20, height: 20, flex: "0 0 20px", borderRadius: 99, display: "grid", placeItems: "center",
                background: "rgba(144,207,162,.2)", color: "#B8E6C6",
              }}><IcCheck size={11} /></span>
              {line}
            </li>
          ))}
        </ul>
      </div>

      <div className="row" style={{ gap: 10, position: "relative", zIndex: 1 }}>
        <MakeInIndia />
        <span style={{ fontSize: 11.2, color: "rgba(255,255,255,.42)", lineHeight: 1.45 }}>
          SIH26004 · MDoNER<br />Designed and built in India
        </span>
      </div>
    </aside>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden>
      <rect width="28" height="28" rx="9" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.2)" />
      <path d="M9 6.5v6.2c0 1.6 1.2 2.6 2.6 3.1" stroke="#B8E6C6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 21.5v-5.6c0-1.7-1.3-2.7-2.8-3.2" stroke="#B8E6C6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10.4 14.2c2.6 1.9 5 2.2 7.4.6" stroke="#F3C87B" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1.6 2" />
    </svg>
  );
}
