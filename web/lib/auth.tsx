"use client";
/**
 * SANDHI — who is holding the phone.
 *
 * Three roles, and they see three different products:
 *
 *   admin      — the programme. Districts, health-worker rosters, camp
 *                assignment, census. Never sees an individual's exercise plan.
 *   volunteer  — the medical volunteer / ASHA worker in a village, running
 *                screenings for the people in front of them.
 *   user       — a person screening themselves: their own kit, their own
 *                camera, their own appointments and helplines. Anyone can
 *                sign up as this role; volunteer and admin access is issued
 *                by the programme, not self-served.
 *
 * The store is deliberately local. There is no auth server in this build, and
 * pretending otherwise would be worse than saying so: credentials are checked
 * on-device against a seeded roster, the session lives in localStorage, and the
 * whole thing works with the radio off — which is the point of the product.
 *
 * NOT a security boundary. Before any real deployment this must be replaced
 * with a server-issued token; the role gate here only shapes the UI.
 */
import * as React from "react";

export type Role = "admin" | "volunteer" | "user";

export interface Account {
  username: string;
  /** Demo build only — see the file header. Never ship a plaintext store. */
  password: string;
  role: Role;
  name: string;
  /** Volunteers are attached to a district; admins oversee all of them. */
  district?: string;
  phone?: string;
  /** ASHA/ANM identifier printed on the referral slip. */
  workerId?: string;
  createdAt: number;
}

export interface Session {
  username: string;
  role: Role;
  name: string;
  district?: string;
  workerId?: string;
  since: number;
}

const ACCOUNTS_KEY = "sandhi.accounts.v1";
const SESSION_KEY = "sandhi.session.v1";

/** The two accounts the build ships with. Shown on the sign-in card. */
export const SEED_ACCOUNTS: Account[] = [
  {
    username: "admin",
    password: "admin",
    role: "admin",
    name: "Programme Office",
    district: "All districts",
    workerId: "NER-ADM-01",
    createdAt: 0,
  },
  {
    username: "ak",
    password: "ak",
    role: "volunteer",
    name: "Anjali Kalita",
    district: "AS-JOR",
    phone: "+91 98640 00000",
    workerId: "ASHA-JOR-0142",
    createdAt: 0,
  },
  {
    username: "priya",
    password: "priya",
    role: "user",
    name: "Priya Devi",
    district: "AS-JOR",
    phone: "+91 91234 56789",
    createdAt: 0,
  },
];

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  volunteer: "/volunteer",
  user: "/user",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Programme admin",
  volunteer: "Medical volunteer",
  user: "Patient",
};

function readAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    const saved: Account[] = raw ? JSON.parse(raw) : [];
    // Seeds always win on username collision, so the demo logins can't be
    // shadowed by a sign-up and locked out.
    const extra = saved.filter((a) => !SEED_ACCOUNTS.some((s) => s.username === a.username));
    return [...SEED_ACCOUNTS, ...extra];
  } catch {
    return SEED_ACCOUNTS;
  }
}

function writeAccounts(all: Account[]) {
  try {
    const extra = all.filter((a) => !SEED_ACCOUNTS.some((s) => s.username === a.username));
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(extra));
  } catch { /* private mode — the session still works for this tab */ }
}

export interface SignUpInput {
  username: string;
  password: string;
  name: string;
  district: string;
  phone: string;
}

interface AuthCtx {
  /** null while the saved session is still being read — render nothing yet. */
  session: Session | null;
  loaded: boolean;
  signIn: (username: string, password: string) => { ok: true; role: Role } | { ok: false; error: string };
  signUp: (input: SignUpInput) => { ok: true; role: Role } | { ok: false; error: string };
  signOut: () => void;
}

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s: Session = JSON.parse(raw);
        if (s?.username && (s.role === "admin" || s.role === "volunteer" || s.role === "user")) setSession(s);
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  const start = React.useCallback((a: Account): Session => {
    const s: Session = {
      username: a.username,
      role: a.role,
      name: a.name,
      district: a.district,
      workerId: a.workerId,
      since: Date.now(),
    };
    setSession(s);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* ignore */ }
    return s;
  }, []);

  const signIn = React.useCallback<AuthCtx["signIn"]>((username, password) => {
    const u = username.trim().toLowerCase();
    const found = readAccounts().find((a) => a.username.toLowerCase() === u);
    // One message for both cases — naming which half was wrong tells an
    // attacker which usernames exist.
    if (!found || found.password !== password) {
      return { ok: false, error: "That username and password do not match." };
    }
    start(found);
    return { ok: true, role: found.role };
  }, [start]);

  const signUp = React.useCallback<AuthCtx["signUp"]>((input) => {
    const u = input.username.trim().toLowerCase();
    if (u.length < 2) return { ok: false, error: "Pick a username of at least 2 characters." };
    if (input.password.length < 2) return { ok: false, error: "Pick a password of at least 2 characters." };
    const all = readAccounts();
    if (all.some((a) => a.username.toLowerCase() === u)) {
      return { ok: false, error: "That username is already taken." };
    }
    // Sign-up always creates a patient ("user") account, for screening
    // yourself. Volunteer and admin access is issued by the programme office,
    // never self-served.
    const account: Account = {
      username: u,
      password: input.password,
      role: "user",
      name: input.name.trim() || u,
      district: input.district,
      phone: input.phone.trim(),
      createdAt: Date.now(),
    };
    writeAccounts([...all, account]);
    start(account);
    return { ok: true, role: "user" };
  }, [start]);

  const signOut = React.useCallback(() => {
    setSession(null);
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }, []);

  const value = React.useMemo(
    () => ({ session, loaded, signIn, signUp, signOut }),
    [session, loaded, signIn, signUp, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}

/** Initials for the avatar chip — "Anjali Kalita" → "AK". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
