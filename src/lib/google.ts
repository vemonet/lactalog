// Google Identity Services (GIS) token-client wrapper. Gives the static app a
// short-lived OAuth access token (no client secret, PKCE-style) to call the
// Sheets API. The token is cached in localStorage so a page reload reuses it
// until it expires. While a tab stays open, we also proactively refresh the
// token in the background a bit before it expires (silent, no popup) so an
// open session effectively never re-prompts for sign-in.
import { createSignal } from 'solid-js';

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: TokenResponse) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'lactalog.token';
// How long before expiry to proactively (and silently) refresh the token.
const REFRESH_MARGIN_MS = 5 * 60_000;

let gisReady: Promise<void> | null = null;
let tokenClient: TokenClient | null = null;
let clientIdUsed = '';
let accessToken = '';
let expiresAt = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

// Per-request handlers (the token client's callback fires globally).
let currentResolve: ((t: string) => void) | null = null;
let currentReject: ((e: Error) => void) | null = null;

// Reactive sign-in state for the UI.
const [authed, setAuthed] = createSignal(false);
export { authed };

// Schedules a silent background refresh shortly before the token expires.
// setToken() calls this again on every successful refresh, so as long as the
// tab stays open and silent refresh keeps working, this chains indefinitely
// and the user never sees a re-login prompt.
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  const ms = expiresAt - Date.now() - REFRESH_MARGIN_MS;
  if (ms > 0) expiryTimer = setTimeout(backgroundRefresh, ms);
}

async function backgroundRefresh(): Promise<void> {
  if (!clientIdUsed) return;
  try {
    await requestToken(clientIdUsed, false);
    // Success: setToken() -> scheduleExpiry() already queued the next refresh.
  } catch {
    // Silent refresh failed (signed out of Google, revoked access, third-party
    // cookies blocked, etc.) — fall back to flipping the UI to "signed out"
    // right when the token actually expires; isSignedIn() already reflects
    // this, but `authed` needs an explicit update since nothing else ticks it.
    const ms = expiresAt - Date.now();
    expiryTimer = setTimeout(() => setAuthed(false), Math.max(0, ms));
  }
}

function setToken(token: string, expiresInSec: number) {
  accessToken = token;
  expiresAt = Date.now() + expiresInSec * 1000;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken, expiresAt }));
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  setAuthed(true);
  scheduleExpiry();
}

// Restore a still-valid token from a previous session so reloads stay signed in.
function restore() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return;
    const { accessToken: a, expiresAt: e } = JSON.parse(raw);
    if (a && e && Date.now() < e - 30_000) {
      accessToken = a;
      expiresAt = e;
      setAuthed(true);
      scheduleExpiry();
    }
  } catch {
    // ignore
  }
}
restore();

function loadGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
  return gisReady;
}

function getClient(clientId: string): TokenClient {
  if (!tokenClient || clientIdUsed !== clientId) {
    if (!window.google) throw new Error('Google Identity Services not loaded');
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          currentReject?.(new Error(resp.error || 'Authorization failed'));
        } else {
          setToken(resp.access_token, resp.expires_in ?? 3600);
          currentResolve?.(accessToken);
        }
        currentResolve = currentReject = null;
      },
      error_callback: (err) => {
        currentReject?.(new Error(err?.type || err?.message || 'Authorization failed'));
        currentResolve = currentReject = null;
      },
    });
    clientIdUsed = clientId;
  }
  return tokenClient;
}

export function isSignedIn(): boolean {
  return accessToken !== '' && Date.now() < expiresAt - 30_000;
}

// Always issues a fresh request to Google (no cached-token shortcut); used
// both by getAccessToken and by the proactive background refresh, which must
// bypass the cache since the cached token is still valid when it fires.
async function requestToken(clientId: string, interactive: boolean): Promise<string> {
  await loadGis();
  const client = getClient(clientId);
  return new Promise<string>((resolve, reject) => {
    currentResolve = resolve;
    currentReject = reject;
    try {
      client.requestAccessToken({ prompt: interactive ? '' : 'none' });
    } catch (e) {
      currentResolve = currentReject = null;
      reject(e as Error);
    }
  });
}

/**
 * Resolve an access token.
 * - Valid cached token -> returned immediately (no network, no popup).
 * - interactive=false -> attempt a SILENT refresh (no UI); rejects if a prompt
 *   would be required (caller can then fall back or ask the user to sign in).
 * - interactive=true  -> show the Google popup if needed.
 */
export async function getAccessToken(clientId: string, interactive: boolean): Promise<string> {
  if (!clientId) throw new Error('Missing OAuth Client ID (set it in src/lib/storage.ts)');
  if (isSignedIn()) return accessToken;
  return requestToken(clientId, interactive);
}

export function signOut(): void {
  const tok = accessToken;
  accessToken = '';
  expiresAt = 0;
  clearTimeout(expiryTimer);
  setAuthed(false);
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  if (tok && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(tok);
  }
}
