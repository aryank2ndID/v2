/**
 * USP 8 & 9 — where to send someone, and who to call.
 *
 * The facility list is generated deterministically from the district table
 * (same seed → same list), because a demo that shuffles its hospitals every
 * refresh is worse than no list. In deployment this table is the one piece
 * that must come from the state health directory; everything around it —
 * distance sort, slot booking, the referral note — stays as it is.
 *
 * The helpline numbers are real and national. They are not generated.
 */

export type FacilityKind = "physio" | "phc" | "chc" | "district";

export interface Facility {
  id: string;
  name: string;
  kind: FacilityKind;
  district: string;
  /** Road kilometres, not straight-line — hills make the difference large. */
  km: number;
  /** Minutes by shared vehicle, the realistic mode in a village. */
  travelMin: number;
  phone: string;
  /** Days from today when the next OA/physio slot is free. */
  nextSlotDays: number;
  /** Runs a joint/physio clinic on these weekdays. */
  days: string[];
  ortho: boolean;
  xray: boolean;
}

export const KIND_LABEL: Record<FacilityKind, string> = {
  physio: "Physiotherapy",
  phc: "Primary Health Centre",
  chc: "Community Health Centre",
  district: "District Hospital",
};

export const KIND_CHIP: Record<FacilityKind, string> = {
  physio: "chip-lilac",
  phc: "chip-sage",
  chc: "chip-sky",
  district: "chip-clay",
};

/* A small, stable PRNG so the directory is identical on every device that
   opens the same district — mulberry32. */
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

const PHYSIO_NAMES = [
  "Sanjeevani Physiotherapy", "Aarogya Movement Clinic", "Brahmaputra Physio Care",
  "Hill District Rehab", "Nabajyoti Physiotherapy", "Pragati Joint Care",
];
const PLACE = [
  "Bazar Road", "Ward 4", "Station Chariali", "Block HQ", "Tea Estate Road", "Mission Road",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface DistrictLite { id: string; name: string; state: string; terrain: number; phc: number }

/**
 * Build the referral options for one district, nearest first.
 * `terrain` stretches travel time — the same 12 km is a different journey in
 * the hills of Meghalaya and on the Jorhat plain.
 */
export function facilitiesFor(d: DistrictLite): Facility[] {
  const r = rng(hash(d.id));
  const drag = 1 + d.terrain * 1.6;
  const out: Facility[] = [];

  // One district hospital — the X-ray and orthopaedic end of the chain.
  out.push({
    id: `${d.id}-DH`,
    name: `${d.name} District Hospital`,
    kind: "district",
    district: d.id,
    km: Math.round((14 + r() * 26) * 10) / 10,
    travelMin: Math.round((38 + r() * 55) * drag),
    phone: phone(r),
    nextSlotDays: 2 + Math.floor(r() * 7),
    days: ["Mon", "Wed", "Fri"],
    ortho: true,
    xray: true,
  });

  // One CHC — has a visiting physiotherapist most weeks.
  out.push({
    id: `${d.id}-CHC`,
    name: `${d.name} Community Health Centre`,
    kind: "chc",
    district: d.id,
    km: Math.round((6 + r() * 13) * 10) / 10,
    travelMin: Math.round((18 + r() * 30) * drag),
    phone: phone(r),
    nextSlotDays: 1 + Math.floor(r() * 5),
    days: ["Tue", "Thu"],
    ortho: r() > 0.55,
    xray: r() > 0.4,
  });

  // Two nearby PHCs — where most people actually go first.
  for (let i = 0; i < 2; i++) {
    out.push({
      id: `${d.id}-PHC${i + 1}`,
      name: `PHC ${PLACE[Math.floor(r() * PLACE.length)]}`,
      kind: "phc",
      district: d.id,
      km: Math.round((1.4 + r() * 6) * 10) / 10,
      travelMin: Math.round((9 + r() * 18) * drag),
      phone: phone(r),
      nextSlotDays: Math.floor(r() * 3),
      days: DAYS.slice(0, 4 + Math.floor(r() * 2)),
      ortho: false,
      xray: false,
    });
  }

  // One or two private physiotherapy clinics.
  const nPhysio = 1 + (r() > 0.45 ? 1 : 0);
  for (let i = 0; i < nPhysio; i++) {
    out.push({
      id: `${d.id}-PT${i + 1}`,
      name: PHYSIO_NAMES[Math.floor(r() * PHYSIO_NAMES.length)],
      kind: "physio",
      district: d.id,
      km: Math.round((3 + r() * 15) * 10) / 10,
      travelMin: Math.round((12 + r() * 26) * drag),
      phone: phone(r),
      nextSlotDays: Math.floor(r() * 4),
      days: DAYS,
      ortho: false,
      xray: false,
    });
  }

  return out.sort((a, b) => a.km - b.km);
}

function phone(r: () => number) {
  const n = () => Math.floor(r() * 10);
  return `+91 9${n()}${n()}${n()}${n()} ${n()}${n()}${n()}${n()}${n()}`;
}

/* ------------------------------------------------------------ helplines -- */

export interface Helpline {
  number: string;
  name: string;
  detail: string;
  /** true when a person in distress should be told to ring it right now. */
  urgent?: boolean;
  languages?: string;
}

/**
 * USP 9 — national helplines. Verified against the MoHFW / india.gov.in
 * directories; these are the numbers a health worker should hand over, not
 * placeholders. Keep them short: a number and one line of why.
 */
export const HELPLINES: Helpline[] = [
  {
    number: "108",
    name: "Emergency ambulance",
    detail: "Free, 24×7, across the North-East.",
    urgent: true,
  },
  {
    number: "104",
    name: "Health helpline",
    detail: "Advice, facility information and complaints.",
    languages: "Regional languages",
  },
  {
    number: "14416",
    name: "Tele-MANAS",
    detail: "Mental health support. Chronic pain wears people down.",
    languages: "20 regional languages",
  },
  {
    number: "14567",
    name: "Elderline",
    detail: "For senior citizens needing help or care.",
  },
  {
    number: "1075",
    name: "National health control room",
    detail: "Public-health information line.",
  },
];
