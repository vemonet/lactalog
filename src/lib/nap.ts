// A sleep session in progress, persisted so it survives reloads/app close
// between pressing "Start sleep" and "Wake up" (can be hours apart).
import { createSignal } from 'solid-js';
import { nowHHMM, todayISO } from './util';

export interface ActiveNap {
  date: string; // YYYY-MM-DD, start date
  time: string; // HH:MM, start time
}

const KEY = 'lactalog.activeNap';

function load(): ActiveNap | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const [activeNap, setActiveNap] = createSignal<ActiveNap | null>(load());
export { activeNap };

export function startNap(): void {
  const nap: ActiveNap = { date: todayISO(), time: nowHHMM() };
  setActiveNap(nap);
  try {
    localStorage.setItem(KEY, JSON.stringify(nap));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
}

export function clearNap(): void {
  setActiveNap(null);
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
