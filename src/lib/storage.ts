import { createStore } from 'solid-js/store';

// The Google OAuth Client ID is public by design: it ships in the client bundle anyway
// Falls back to the VITE_GOOGLE_CLIENT_ID env var if this is left blank.
const GOOGLE_CLIENT_ID = '491763974312-m892d5roc3e3c6h9lhjb7slt39ha8766.apps.googleusercontent.com';

export interface Settings {
  spreadsheetUrl: string;
  feedingSheet: string;
  milkingSheet: string;
  sleepingSheet: string;
  birthDate: string; // YYYY-MM-DD
  birthWeightKg: number;
  feedsPerDay: number;
}

const DEFAULTS: Settings = {
  spreadsheetUrl: '',
  feedingSheet: 'Feeding',
  milkingSheet: 'Milking',
  sleepingSheet: 'Sleeping',
  birthDate: '',
  birthWeightKg: 3.4,
  feedsPerDay: 0, // 0 = auto (derived from age)
};

const KEY = 'lactalog.settings';

// A single Client ID lets every user just click "Sign in with Google". It's
// public by design (it ships in the bundle), so it is committed here.
// The env var is a fallback for CI-only overrides.
const CONFIGURED = GOOGLE_CLIENT_ID.startsWith('PASTE_') ? '' : GOOGLE_CLIENT_ID;
export const ENV_CLIENT_ID = CONFIGURED || ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '');

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

const [settings, setSettingsStore] = createStore<Settings>(load());

export { settings };

export function saveSettings(patch: Partial<Settings>): void {
  setSettingsStore(patch);
  localStorage.setItem(KEY, JSON.stringify(settings));
}

// Extract the spreadsheet id from a full Google Sheets URL (or a bare id).
export function spreadsheetId(): string {
  const url = settings.spreadsheetUrl.trim();
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // Allow pasting a bare id.
  if (/^[a-zA-Z0-9-_]{20,}$/.test(url)) return url;
  return '';
}

export function isConfigured(): boolean {
  return spreadsheetId() !== '';
}

export function effectiveClientId(): string {
  return ENV_CLIENT_ID;
}

export function hasClientId(): boolean {
  return effectiveClientId() !== '';
}
