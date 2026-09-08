/**
 * USP 5 — health workers as agents, not rows.
 *
 * The programme office does one job repeatedly: it looks at who is free this
 * week, looks at which villages are overdue, and puts the two together. That
 * is the whole model here — a roster with real availability, a list of camps
 * with a shortfall, and an assignment that moves between them.
 *
 * Assignments live in localStorage so the demo survives a refresh. In
 * deployment they are the payload the sync server already carries.
 *
 * USP 7 — the census view is derived from the same roster plus the screening
 * cohort, so coverage is always "screened ÷ adult population", never a number
 * typed in by hand.
 */

export type WorkerStatus = "available" | "on-camp" | "leave";

export interface Worker {
  id: string;
  name: string;
  district: string;
  village: string;
  status: WorkerStatus;
  /** Screenings completed in the last 30 days — the load signal. */
  recent: number;
  /** Kit in hand, or sharing one. */
  hasKit: boolean;
  phone: string;
  /** Years on the job. Experience is why some camps go to some people. */
  years: number;
  languages: string[];
}

export interface Camp {
  id: string;
  village: string;
  district: string;
  /** Days from today. Negative means it has already run. */
  inDays: number;
  /** Adults 40+ expected to attend — the number that sets the staffing need. */
  expected: number;
  /** How many workers this camp needs to finish in a day. */
  need: number;
  /** Worker ids assigned. */
  assigned: string[];
  terrainNote: string;
}

const FIRST = [
  "Anjali", "Bhaskar", "Chayanika", "Dipika", "Eshita", "Gitanjali", "Hemanta",
  "Ibemcha", "Jonali", "Kaberi", "Lalrin", "Monimala", "Nirmali", "Pallabi",
  "Rekha", "Sangita", "Tara", "Urmila", "Wanphrang", "Zothan",
];
const LAST = [
  "Kalita", "Baruah", "Das", "Nath", "Sangma", "Marak", "Lyngdoh", "Devi",
  "Rabha", "Boro", "Chakma", "Jamir", "Ao", "Rai", "Tamang", "Pegu",
];
/* Village names are drawn per state. A Khasi village name showing up in a
   Tripura district is the kind of detail a reviewer from the region notices
   immediately, and it costs nothing to get right. */
const VILLAGE_BY_STATE: Record<string, string[]> = {
  "Assam": ["Balijan", "Cinnamara", "Dergaon", "Titabor", "Mariani", "Sonari",
            "Namti", "Bokakhat", "Rangia Pathar", "Nagaon Bosti"],
  "Meghalaya": ["Lumsohphoh", "Mawkynrew", "Nongstoin", "Mawphlang", "Umden",
                "Rongjeng", "Wahiajer"],
  "Manipur": ["Chandel Khunou", "Wangoi", "Kwakta", "Sekmai", "Moirang Khunou"],
  "Nagaland": ["Tuensang Gaon", "Chumukedima", "Medziphema", "Longkhim", "Aoyimti"],
  "Arunachal Pradesh": ["Doimukh", "Kimin", "Sagalee", "Balijan Gaon", "Nirjuli"],
  "Mizoram": ["Sairang", "Darlawn", "Thenzawl", "Bawngkawn", "Lengpui"],
  "Tripura": ["Bishalgarh", "Melaghar", "Jampuijala", "Kamalpur Para", "Teliamura"],
  "Sikkim": ["Rumtek", "Ranipool", "Pakyong Busty", "Martam", "Assam Lingzey"],
};

const VILLAGE_FALLBACK = ["Balijan", "Dergaon", "Sonari", "Namti", "Bokakhat"];

const villagesIn = (state: string) => VILLAGE_BY_STATE[state] ?? VILLAGE_FALLBACK;
const LANGS = ["Assamese", "Hindi", "Bengali", "Khasi", "Bodo", "Nagamese", "Manipuri", "Mizo"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

export interface DistrictLite { id: string; name: string; state: string; terrain: number; phc: number; pop: number }

/** Roster for the whole programme: roughly one worker per PHC in catchment. */
export function buildRoster(districts: DistrictLite[]): Worker[] {
  const out: Worker[] = [];
  for (const d of districts) {
    const r = rng(hash(`roster:${d.id}`));
    const n = Math.max(3, Math.min(9, Math.round(d.phc * 0.6)));
    for (let i = 0; i < n; i++) {
      const roll = r();
      out.push({
        id: `ASHA-${d.id.split("-")[1]}-${String(100 + i * 7 + Math.floor(r() * 6)).padStart(4, "0")}`,
        name: `${pick(r, FIRST)} ${pick(r, LAST)}`,
        district: d.id,
        village: pick(r, villagesIn(d.state)),
        status: roll > 0.78 ? "on-camp" : roll > 0.68 ? "leave" : "available",
        recent: Math.floor(r() * 46),
        hasKit: r() > 0.35,
        phone: `+91 9${Math.floor(r() * 9)}${Math.floor(r() * 10)}${Math.floor(r() * 10)}${Math.floor(r() * 10)} ${Math.floor(r() * 90000 + 10000)}`,
        years: 1 + Math.floor(r() * 12),
        languages: Array.from(new Set([pick(r, LANGS), pick(r, LANGS)])),
      });
    }
  }
  return out;
}

const TERRAIN_NOTE = [
  "Road washes out after rain — go early.",
  "Last 4 km on foot.",
  "Shared jeep only, twice a day.",
  "Flat approach, vehicle to the door.",
  "Steep climb from the block road.",
  "River crossing by ferry.",
  "Bamboo bridge — no vehicle past it.",
  "Tea estate road, passable in the dry season.",
];

/** The subset that applies once the slope index passes 0.45. */
const HILL_NOTE = [
  "Road washes out after rain — go early.",
  "Last 4 km on foot.",
  "Shared jeep only, twice a day.",
  "Steep climb from the block road.",
  "River crossing by ferry.",
  "Bamboo bridge — no vehicle past it.",
];

/** The camp calendar: past three weeks and the next four. */
export function buildCamps(districts: DistrictLite[]): Camp[] {
  const out: Camp[] = [];
  for (const d of districts) {
    const r = rng(hash(`camps:${d.id}`));
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const expected = 40 + Math.floor(r() * 190);
      out.push({
        id: `CAMP-${d.id}-${i + 1}`,
        village: pick(r, villagesIn(d.state)),
        district: d.id,
        inDays: Math.round((r() * 34) - 8),
        expected,
        // One worker screens roughly 45 people in a camp day.
        need: Math.max(1, Math.ceil(expected / 45)),
        assigned: [],
        // Hill districts draw from the harder-access notes only; plains
        // districts can draw from the whole list.
        terrainNote: d.terrain > 0.45
          ? HILL_NOTE[Math.floor(r() * HILL_NOTE.length)]
          : pick(r, TERRAIN_NOTE),
      });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/* ------------------------------------------------------- assignment store */

const ASSIGN_KEY = "sandhi.assignments.v1";

/** campId → workerId[] */
export type Assignments = Record<string, string[]>;

export function loadAssignments(): Assignments {
  try {
    const raw = localStorage.getItem(ASSIGN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveAssignments(a: Assignments) {
  try { localStorage.setItem(ASSIGN_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

/* ------------------------------------------------------------- matching -- */

export interface Suggestion { worker: Worker; score: number; reason: string }

/**
 * Who should take this camp. Ranked, with the reason stated — an assignment
 * an admin cannot explain is one they will not trust.
 *
 * The weights encode the real constraints: someone on leave cannot go, the
 * district is a hard boundary, a kit in hand is worth more than experience,
 * and the person who did 40 screenings last month should get a lighter week.
 */
export function suggestFor(camp: Camp, roster: Worker[], assignments: Assignments): Suggestion[] {
  const taken = new Set(Object.entries(assignments)
    .filter(([id]) => id !== camp.id)
    .flatMap(([, ws]) => ws));

  return roster
    .filter((w) => w.district === camp.district)
    .filter((w) => w.status !== "leave")
    .filter((w) => !(assignments[camp.id] ?? []).includes(w.id))
    .map((w) => {
      let score = 50;
      const why: string[] = [];
      if (w.status === "available") { score += 22; why.push("free this week"); }
      if (w.hasKit) { score += 18; why.push("has a kit"); }
      if (w.village === camp.village) { score += 20; why.push("lives in the village"); }
      if (taken.has(w.id)) { score -= 26; why.push("already on another camp"); }
      // Even out the load: lighter recent weeks rank higher.
      score += Math.round((30 - Math.min(30, w.recent)) * 0.5);
      if (w.recent < 10) why.push("light recent load");
      if (w.years >= 6) { score += 8; why.push(`${w.years} years on the job`); }
      return { worker: w, score, reason: why.slice(0, 2).join(" · ") || "in district" };
    })
    .sort((a, b) => b.score - a.score);
}

export const STATUS_LABEL: Record<WorkerStatus, string> = {
  available: "Available",
  "on-camp": "On camp",
  leave: "On leave",
};
export const STATUS_CHIP: Record<WorkerStatus, string> = {
  available: "chip-sage",
  "on-camp": "chip-sky",
  leave: "chip-amber",
};
