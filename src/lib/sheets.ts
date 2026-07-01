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

// Authenticated read via Sheets API v4: works for private sheets shared with the
// signed-in account. One batchGet call returns both sheets.
async function readViaApi(token: string): Promise<{ feeding: FeedingEntry[]; milking: MilkingEntry[] }> {
  const id = spreadsheetId();
  const ranges = [settings.feedingSheet, settings.milkingSheet].map((s) => `ranges=${encodeURIComponent(s)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet` + `?${ranges}&majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Read failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const vr = data.valueRanges ?? [];
  return {
    feeding: mapFeeding(vr[0]?.values ?? []),
    milking: mapMilking(vr[1]?.values ?? []),
  };
}

/**
 * Read both sheets. Uses the Sheets API when signed in (supports PRIVATE sheets),
 * otherwise falls back to the public CSV endpoint for shared sheets.
 */
export async function fetchAll(): Promise<{ feeding: FeedingEntry[]; milking: MilkingEntry[] }> {
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
    const [f, m] = await Promise.all([readCSV(settings.feedingSheet), readCSV(settings.milkingSheet)]);
    return { feeding: mapFeeding(f), milking: mapMilking(m) };
  } catch {
    throw new Error(
      "Couldn't read the sheet. If it's private, click “Sign in” (top right) to load it with your Google account — otherwise share it as “Anyone with the link”."
    );
  }
}

// Authenticated write: append a row via Sheets API v4. USER_ENTERED so the
// sheet parses dates/numbers like a manual entry.
async function appendRow(sheet: string, values: (string | number)[]): Promise<void> {
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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Append failed (HTTP ${res.status}). ${body.slice(0, 200)}`);
  }
}

export function addFeeding(e: FeedingEntry): Promise<void> {
  return appendRow(settings.feedingSheet, [e.date, e.time, e.qty, e.type]);
}

export function addMilking(e: MilkingEntry): Promise<void> {
  return appendRow(settings.milkingSheet, [e.date, e.time, e.qty]);
}
