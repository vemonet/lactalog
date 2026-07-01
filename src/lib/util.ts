// Small date/number helpers. All dates are handled as local-time YYYY-MM-DD
// strings to match what the sheet stores, avoiding timezone drift.

export function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

export function todayISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function nowHHMM(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Days between two YYYY-MM-DD dates (b - a), ignoring time of day.
export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + 'T00:00:00');
  const b = new Date(bISO + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// European day/month, e.g. "30.06" (compact, for chart labels).
export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

// European full date, e.g. "30.06.2026" (for tables and inputs).
export function fmtDateEU(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Last `n` ISO dates ending today (oldest first).
export function lastNDates(n: number, end: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(todayISO(d));
  }
  return out;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

// Combine a YYYY-MM-DD date and HH:MM time into a local Date (NaN-safe).
export function parseDateTime(dateISO: string, timeHHMM: string): Date {
  const t = /^\d{1,2}:\d{2}/.test(timeHHMM) ? timeHHMM : '00:00';
  return new Date(`${dateISO}T${t.length === 4 ? '0' + t : t}:00`);
}

// "2h 15m", "45m", "just now" for a millisecond duration.
export function humanDuration(ms: number): string {
  const mins = Math.round(Math.abs(ms) / 60000);
  if (mins < 1) return 'just now';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function round(n: number, digits = 0): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields and escaped quotes).
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
