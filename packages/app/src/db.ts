/**
 * SANDHI - offline-first storage.
 *
 * Two tables:
 *   screenings  the outbox. A finished screening is written here the moment it
 *               is scored (airplane mode on), and only leaves when a sync back
 *               to the district server succeeds. client_id is the idempotency
 *               key the Go server dedupes on.
 *   settings    key/value for the sync URL and UI language.
 */
import * as SQLite from "expo-sqlite";

import type { Band } from "./lib/runtime";

export interface ScreeningRecord {
  client_id: string;
  patient: string;
  district: string;
  risk: number;
  band: Band;
  features: Record<string, number>;
  captured_at: string;
  created_at: number;
  state: "queued" | "sending" | "sent" | "failed";
}

interface Row {
  client_id: string;
  patient: string;
  district: string;
  risk: number;
  band: Band;
  features: string;
  captured_at: string;
  created_at: number;
  state: string;
}

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) db = await SQLite.openDatabaseAsync("sandhi.db");
  return db;
}

export async function initDb(): Promise<void> {
  const d = await getDb();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS screenings (
      client_id   TEXT PRIMARY KEY,
      patient     TEXT NOT NULL,
      district    TEXT NOT NULL,
      risk        REAL NOT NULL,
      band        TEXT NOT NULL,
      features    TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      state       TEXT NOT NULL DEFAULT 'queued'
    );
    CREATE TABLE IF NOT EXISTS settings (
      k TEXT PRIMARY KEY,
      v TEXT NOT NULL
    );
  `);
}

export async function enqueueScreening(r: ScreeningRecord): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    `INSERT OR REPLACE INTO screenings
       (client_id, patient, district, risk, band, features, captured_at, created_at, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.client_id,
    r.patient,
    r.district,
    r.risk,
    r.band,
    JSON.stringify(r.features),
    r.captured_at,
    r.created_at,
    r.state,
  );
}

function rowToRecord(row: Row): ScreeningRecord {
  return {
    client_id: row.client_id,
    patient: row.patient,
    district: row.district,
    risk: row.risk,
    band: row.band,
    features: JSON.parse(row.features),
    captured_at: row.captured_at,
    created_at: row.created_at,
    state: (row.state as ScreeningRecord["state"]) || "queued",
  };
}

export async function listScreenings(): Promise<ScreeningRecord[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<Row>(
    "SELECT * FROM screenings ORDER BY created_at DESC",
  );
  return rows.map(rowToRecord);
}

export async function listPending(): Promise<ScreeningRecord[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<Row>(
    `SELECT * FROM screenings WHERE state IN ('queued', 'failed', 'sending')
     ORDER BY created_at ASC`,
  );
  return rows.map(rowToRecord);
}

export async function setScreeningState(clientId: string, state: ScreeningRecord["state"]): Promise<void> {
  const d = await getDb();
  await d.runAsync("UPDATE screenings SET state = ? WHERE client_id = ?", state, clientId);
}

export async function clearSent(): Promise<void> {
  const d = await getDb();
  await d.runAsync("DELETE FROM screenings WHERE state = 'sent'");
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const d = await getDb();
  const row = await d.getFirstAsync<{ v: string }>(
    "SELECT v FROM settings WHERE k = ?",
    key,
  );
  return row ? row.v : fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const d = await getDb();
  await d.runAsync(
    "INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)",
    key,
    value,
  );
}

export async function countSent(): Promise<number> {
  const d = await getDb();
  const row = await d.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM screenings WHERE state = 'sent'",
  );
  return row?.n ?? 0;
}

/** POST pending screenings to the district server; batch like the Go server expects. */
export async function flushToServer(serverUrl: string): Promise<{ sent: number; failed: number }> {
  const pending = await listPending();
  if (!pending.length) return { sent: 0, failed: 0 };
  const body = pending.map((r) => ({
    client_id: r.client_id,
    patient: r.patient,
    district: r.district,
    risk: r.risk,
    band: r.band,
    features: r.features,
    captured_at: r.captured_at,
  }));
  let sent = 0;
  let failed = 0;
  const url = serverUrl.replace(/\/+$/, "") + "/v1/screenings";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as {
        accepted?: number;
        created?: number;
      } | null;
      sent = json && typeof json.accepted === "number" ? json.accepted : pending.length;
      for (const r of pending) await setScreeningState(r.client_id, "sent");
      failed = 0;
    } else {
      failed = pending.length;
    }
  } catch {
    failed = pending.length;
    for (const r of pending) {
      if (r.state !== "sending") await setScreeningState(r.client_id, "failed");
    }
  }
  return { sent, failed };
}