import { daysBetween, todayISO } from './util';

export interface Expected {
  ageDays: number;
  estWeightKg: number;
  dailyMl: number;
  feeds: number; // recommended number of feeds per day
  perFeedMl: number; // dailyMl / feeds
  intervalHours: number; // 24 / feeds
  feedsAuto: boolean; // whether feeds was derived from age (vs. user override)
  note: string;
}

// Per-feed volumes for the first days of life (~8 feeds/day, every ~3h).
// Rough, widely-cited newborn guideline. NOT medical advice.
const EARLY_PER_FEED: Record<number, number> = {
  0: 7,
  1: 7,
  2: 14,
  3: 27,
  4: 40,
  5: 45,
  6: 50,
  7: 60,
  8: 70,
  9: 75,
  10: 80,
};

// Feeds naturally space out as the baby grows: frequent small feeds as a
// newborn, fewer larger bottles later.
export function recommendedFeeds(ageDays: number): number {
  const months = ageDays / 30.4;
  if (months < 1) return 8; // ~every 3h
  if (months < 2) return 7;
  if (months < 4) return 6;
  if (months < 6) return 5;
  return 5; // 6m+ (solids start to supplement)
}

/**
 * Estimate expected daily intake AND how it splits into bottles.
 * - Daily volume: first ~10 days use the newborn per-feed table; after that the
 *   150 mL/kg/day rule on an estimated weight (birth weight grown ~30 g/day),
 *   capped ~1000 mL.
 * - Feeds/day: derived from age unless the user set an explicit override (>0).
 * - Per-bottle: daily / feeds.
 */
export function computeExpected(birthDate: string, birthWeightKg: number, feedsOverride: number): Expected | null {
  if (!birthDate) return null;
  const ageDays = Math.max(0, daysBetween(birthDate, todayISO()));
  const feedsAuto = !(feedsOverride > 0);
  const feeds = feedsAuto ? recommendedFeeds(ageDays) : feedsOverride;
  const estWeightKg = (birthWeightKg || 3.4) + 0.03 * ageDays;

  let dailyMl: number;
  let note: string;
  if (ageDays <= 10) {
    const perFeed = EARLY_PER_FEED[ageDays] ?? 80;
    dailyMl = perFeed * 8;
    note = `Day ${ageDays}: newborn guideline.`;
  } else {
    dailyMl = Math.min(150 * estWeightKg, 1000);
    note = `150 mL/kg/day at est. ${estWeightKg.toFixed(1)} kg.`;
  }

  return {
    ageDays,
    estWeightKg,
    dailyMl: Math.round(dailyMl),
    feeds,
    perFeedMl: Math.round(dailyMl / feeds),
    intervalHours: 24 / feeds,
    feedsAuto,
    note,
  };
}
