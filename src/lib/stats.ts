import { fmtDateShort, lastNDates, sum } from './util';

interface Entry {
  date: string;
  time: string;
  qty: number;
}

export function onDate<T extends Entry>(entries: T[], dateISO: string): T[] {
  return entries.filter((e) => e.date === dateISO);
}

export function totalQty(entries: Entry[]): number {
  return sum(entries.map((e) => e.qty));
}

// Sum of qty per day for the last n days (chart-ready).
export function perDaySeries(entries: Entry[], n: number) {
  const dates = lastNDates(n);
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.qty);
  return {
    labels: dates.map(fmtDateShort),
    values: dates.map((d) => map.get(d) ?? 0),
    dates,
  };
}

// Count per day (for feeds/sessions counts).
export function countPerDaySeries(entries: Entry[], n: number) {
  const dates = lastNDates(n);
  const map = new Map<string, number>();
  for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + 1);
  return { labels: dates.map(fmtDateShort), values: dates.map((d) => map.get(d) ?? 0) };
}

// 8 three-hour buckets across the day, summing volume.
export function timeOfDayBuckets(entries: Entry[]) {
  const buckets = new Array(8).fill(0);
  for (const e of entries) {
    const h = parseInt((e.time || '0').split(':')[0], 10);
    if (Number.isFinite(h)) buckets[Math.min(7, Math.floor(h / 3))] += e.qty;
  }
  const labels = ['0-3', '3-6', '6-9', '9-12', '12-15', '15-18', '18-21', '21-24'];
  return { labels, values: buckets };
}

// Average daily volume over the last n days that actually have data.
export function avgDaily(entries: Entry[], n: number): number {
  const { values } = perDaySeries(entries, n);
  const active = values.filter((v) => v > 0);
  if (active.length === 0) return 0;
  return sum(active) / active.length;
}
