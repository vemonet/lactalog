import { parseCSV } from './util';
import { getAccessToken } from './google';
import { effectiveClientId, settings, spreadsheetId } from './storage';

export interface FeedingEntry {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  qty: number; // mL
  type: string;
}

export interface MilkingEntry {
  date: string;
  time: string;
  qty: number; // mL
}

export interface SleepEntry {
  date: string;
  time: string; // HH:MM, start of sleep
  endTime: string; // HH:MM, end of sleep
  qty: number; // minutes asleep
}

function toNum(s: unknown): number {
  const n = parseFloat(
    String(s ?? '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '')
  );
  return Number.isFinite(n) ? n : NaN;
}

const cell = (v: unknown) => String(v ?? '').trim();

// Rows are [Date, Heure, Quantité, Type], header at row 0. Empty/template rows
// (no date or non-numeric quantity) are skipped.
function mapFeeding(rows: unknown[][]): FeedingEntry[] {
  const out: FeedingEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const q = toNum(r[2]);
    if (!cell(r[0]) || !Number.isFinite(q)) continue;
    out.push({ date: cell(r[0]), time: cell(r[1]), qty: q, type: cell(r[3]) });
  }
  return out;
}

function mapMilking(rows: unknown[][]): MilkingEntry[] {
  const out: MilkingEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const q = toNum(r[2]);
    if (!cell(r[0]) || !Number.isFinite(q)) continue;
    out.push({ date: cell(r[0]), time: cell(r[1]), qty: q });
  }
  return out;
}

// Rows are [Date, Début, Fin, Durée (min)].
function mapSleeping(rows: unknown[][]): SleepEntry[] {
  const out: SleepEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const q = toNum(r[3]);
    if (!cell(r[0]) || !Number.isFinite(q)) continue;
    out.push({ date: cell(r[0]), time: cell(r[1]), endTime: cell(r[2]), qty: q });
  }
  return out;
}

// Public read: the gviz CSV endpoint works only for a sheet shared "anyone with
// the link". A private sheet 302-redirects to a login page (CORS error), so we
// only use this path when NOT signed in.
async function readCSV(sheet: string): Promise<unknown[][]> {
  const id = spreadsheetId();
  const url =
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('not-public');
  return parseCSV(text);
}

// A sheet/tab that doesn't exist yet in the spreadsheet fails with this error;
// treat it as simply empty instead of a hard failure, so a fresh spreadsheet
// (before its first entry auto-creates the tab, see appendRow) shows 0 entries
// rather than a scary error.
function isMissingSheetError(body: string): boolean {
  return /Unable to parse range/i.test(body);
}

// Authenticated read via Sheets API v4: works for private sheets shared with the
// signed-in account. Reads each sheet independently so a missing tab on one side
// doesn't fail the other.
async function readRange(id: string, token: string, sheet: string): Promise<unknown[][]> {
  const range = encodeURIComponent(sheet);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) return (await res.json()).values ?? [];
  const body = await res.text().catch(() => '');
  if (res.status === 400 && isMissingSheetError(body)) return [];
  throw new Error(`Read failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
}

interface AllEntries {
  feeding: FeedingEntry[];
  milking: MilkingEntry[];
  sleeping: SleepEntry[];
}

async function readViaApi(token: string): Promise<AllEntries> {
  const id = spreadsheetId();
  const [f, m, s] = await Promise.all([
    readRange(id, token, settings.feedingSheet),
    readRange(id, token, settings.milkingSheet),
    readRange(id, token, settings.sleepingSheet),
  ]);
  return { feeding: mapFeeding(f), milking: mapMilking(m), sleeping: mapSleeping(s) };
}

/**
 * Read all three sheets. Uses the Sheets API when signed in (supports PRIVATE
 * sheets), otherwise falls back to the public CSV endpoint for shared sheets.
 */
export async function fetchAll(): Promise<AllEntries> {
  if (!spreadsheetId()) throw new Error('No spreadsheet configured');
  // Use the Sheets API when we have (or can silently refresh) a token; this is
  // the only path that reads private sheets. Silent refresh avoids a popup.
  let token = '';
  try {
    // Never interactive here: cached token if valid, else a silent refresh.
    token = await getAccessToken(effectiveClientId(), false);
  } catch {
    token = '';
  }
  if (token) return readViaApi(token);
  try {
    const [f, m, s] = await Promise.all([
      readCSV(settings.feedingSheet),
      readCSV(settings.milkingSheet),
      readCSV(settings.sleepingSheet),
    ]);
    return { feeding: mapFeeding(f), milking: mapMilking(m), sleeping: mapSleeping(s) };
  } catch {
    throw new Error(
      "Couldn't read the sheet. If it's private, click “Sign in” (top right) to load it with your Google account — otherwise share it as “Anyone with the link”."
    );
  }
}

const FEEDING_HEADER = ['Date', 'Heure', 'Quantité (mL)', 'Type'];
const MILKING_HEADER = ['Date', 'Heure', 'Quantité (mL)'];
const SLEEPING_HEADER = ['Date', 'Début', 'Fin', 'Durée (min)'];

// Add a tab with the given title + header row. Used to auto-init a sheet the
// first time an entry is added to it.
async function createSheet(id: string, token: string, title: string, header: string[]): Promise<void> {
  const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
  if (!addRes.ok) {
    const body = await addRes.text().catch(() => '');
    throw new Error(`Couldn't create sheet "${title}" (HTTP ${addRes.status}). ${body.slice(0, 200)}`);
  }
  const range = `${encodeURIComponent(title)}!A1`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [header] }),
  });
}

// Authenticated write: append a row via Sheets API v4. USER_ENTERED so the
// sheet parses dates/numbers like a manual entry. If the tab doesn't exist yet,
// create it (with a header row) and retry once.
async function appendRow(sheet: string, values: (string | number)[], header: string[], retry = true): Promise<void> {
  const id = spreadsheetId();
  const token = await getAccessToken(effectiveClientId(), true);
  const range = `${encodeURIComponent(sheet)}!A1`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  if (retry && res.status === 400 && isMissingSheetError(body)) {
    await createSheet(id, token, sheet, header);
    return appendRow(sheet, values, header, false);
  }
  throw new Error(`Append failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
}

export function addFeeding(e: FeedingEntry): Promise<void> {
  return appendRow(settings.feedingSheet, [e.date, e.time, e.qty, e.type], FEEDING_HEADER);
}

export function addMilking(e: MilkingEntry): Promise<void> {
  return appendRow(settings.milkingSheet, [e.date, e.time, e.qty], MILKING_HEADER);
}

export function addSleeping(e: SleepEntry): Promise<void> {
  return appendRow(settings.sleepingSheet, [e.date, e.time, e.endTime, e.qty], SLEEPING_HEADER);
}
