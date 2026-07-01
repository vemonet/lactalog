// Google Identity Services (GIS) token-client wrapper. Gives the static app a
// short-lived OAuth access token (no client secret, PKCE-style) to call the
// Sheets API. The token is cached in localStorage so a page reload reuses it
// until it expires; when expired we try a SILENT refresh (prompt: "none") and
// only fall back to an interactive popup if that fails.
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

function scheduleExpiry() {
  clearTimeout(expiryTimer);
  const ms = expiresAt - Date.now();
  if (ms > 0) expiryTimer = setTimeout(() => setAuthed(false), ms);
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
