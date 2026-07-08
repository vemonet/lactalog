// Detect whether a new entry equals or beats one of the displayed records.
//
// Records are computed from the entries that existed BEFORE the new one is
// saved, so the comparison is "does this new entry set a record?". The checks
// mirror what each page shows in its "Records" section:
//   Feeding : biggest feed, biggest day, longest gap
//   Milking : biggest pump, best day
//   Sleeping: longest sleep, longest awake gap
import type { FeedingEntry, MilkingEntry, SleepEntry } from './sheets';
import { bestDayTotal, longestGapMinutes, maxEntry, totalQty } from './stats';
import { parseDateTime } from './util';

interface EntryLike {
  date: string;
  time: string;
  qty: number;
}

// Biggest single entry (feed/pump/sleep). Skipped when there's nothing to beat.
function beatsMaxEntry(entries: EntryLike[], newQty: number): boolean {
  if (entries.length === 0) return false;
  const max = maxEntry(entries);
  return max !== null && newQty >= max.qty;
}

// Best single-day total. Triggered on the entry that makes today's running
// total first reach or exceed the best day across all OTHER days - so we
// celebrate exactly once per record-setting day, not on every subsequent feed.
function beatsBestDay(entries: EntryLike[], newEntry: EntryLike): boolean {
  if (entries.length === 0) return false;
  const otherDays = entries.filter((e) => e.date !== newEntry.date);
  const bestOther = bestDayTotal(otherDays);
  const todayBefore = totalQty(entries.filter((e) => e.date === newEntry.date));
  const todayAfter = todayBefore + newEntry.qty;
  return todayAfter >= bestOther && todayBefore < bestOther;
}

// Longest gap between consecutive entries. The new entry only creates one new
// gap (to its nearest neighbor), and only beats the record if that gap is
// longer than the previous longest. Requires at least 2 existing entries so
// there's a real record to beat rather than the trivial "first gap".
function beatsLongestGap(entries: EntryLike[], newEntry: EntryLike): boolean {
  if (entries.length < 2) return false;
  const newDt = parseDateTime(newEntry.date, newEntry.time).getTime();
  if (Number.isNaN(newDt)) return false;
  let nearest = Infinity;
  for (const e of entries) {
    const dt = parseDateTime(e.date, e.time).getTime();
    if (Number.isNaN(dt)) continue;
    const gap = Math.abs(newDt - dt);
    if (gap < nearest) nearest = gap;
  }
  return Number.isFinite(nearest) && nearest / 60000 > longestGapMinutes(entries);
}

export function feedingBeatsRecord(entries: FeedingEntry[], newEntry: FeedingEntry): boolean {
  return beatsMaxEntry(entries, newEntry.qty) || beatsBestDay(entries, newEntry) || beatsLongestGap(entries, newEntry);
}

export function milkingBeatsRecord(entries: MilkingEntry[], newEntry: MilkingEntry): boolean {
  return beatsMaxEntry(entries, newEntry.qty) || beatsBestDay(entries, newEntry);
}

export function sleepingBeatsRecord(entries: SleepEntry[], newEntry: SleepEntry): boolean {
  return beatsMaxEntry(entries, newEntry.qty) || beatsLongestGap(entries, newEntry);
}
