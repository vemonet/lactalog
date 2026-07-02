import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Tabs } from '@kobalte/core/tabs';
import { Dialog } from '@kobalte/core/dialog';
import { Feeding } from './pages/Feeding';
import { Milking } from './pages/Milking';
import { Sleeping } from './pages/Sleeping';
import { SettingsForm } from './components/SettingsForm';
import { error, loading, loadedOnce, refresh } from './lib/data';
import { effectiveClientId, hasClientId, isConfigured, spreadsheetId } from './lib/storage';
import { authed, getAccessToken, signOut } from './lib/google';

const ICON = `${import.meta.env.BASE_URL}icon.svg`;

export function App() {
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [authError, setAuthError] = createSignal('');

  onMount(() => {
    if (isConfigured()) refresh();

    // Keep data fresh in the background so multi-device edits show up without a
    // manual refresh. Poll only while the tab is visible and not already loading.
    const maybeRefresh = () => {
      if (isConfigured() && !loading() && document.visibilityState === 'visible') refresh();
    };
    const timer = setInterval(maybeRefresh, 20_000);
    // Refresh immediately when the user returns to the tab (rather than waiting
    // for the next tick), but only once we've loaded at least once.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && loadedOnce()) maybeRefresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    onCleanup(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  });

  async function login() {
    setAuthError('');
    try {
      await getAccessToken(effectiveClientId(), true);
      refresh(); // reload via the Sheets API (works for private sheets)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div class="app">
      <Show when={isConfigured()} fallback={<Onboarding />}>
        <header class="topbar">
          <div class="brand">
            <img src={ICON} alt="" />
            <span class="brand-text">LactaLog</span>
          </div>
          <div class="spacer" />
          <Show when={hasClientId()}>
            <Show
              when={authed()}
              fallback={
                <button class="chip-btn" title="Sign in to add entries" onClick={login}>
                  <GoogleIcon /> <span class="chip-label">Sign in</span>
                </button>
              }
            >
              <button class="chip-btn signed" title="Signed in · click to sign out" onClick={signOut}>
                ✓ <span class="chip-label">Signed in</span>
              </button>
            </Show>
          </Show>
          <button class="icon-btn" title="Refresh" onClick={() => refresh()}>
            <RefreshIcon spinning={loading()} />
          </button>
          <SettingsDialog open={settingsOpen()} onOpenChange={setSettingsOpen} />
        </header>

        <Show when={error()}>
          <div class="banner error">{error()}</div>
        </Show>
        <Show when={authError()}>
          <div class="banner error">{authError()}</div>
        </Show>

        <Tabs class="tabs" defaultValue="feeding">
          <Tabs.List class="tabs__list">
            <Tabs.Trigger class="tabs__trigger" value="feeding">
              🍼 Feeding
            </Tabs.Trigger>
            <Tabs.Trigger class="tabs__trigger" value="milking">
              🥛 Milking
            </Tabs.Trigger>
            <Tabs.Trigger class="tabs__trigger" value="sleeping">
              🛌 Sleeping
            </Tabs.Trigger>
          </Tabs.List>
          <div style={{ 'margin-top': '14px' }}>
            <Tabs.Content value="feeding">
              <Feeding />
            </Tabs.Content>
            <Tabs.Content value="milking">
              <Milking />
            </Tabs.Content>
            <Tabs.Content value="sleeping">
              <Sleeping />
            </Tabs.Content>
          </div>
        </Tabs>

        <Show when={spreadsheetId()}>
          <a
            class="sheet-link"
            href={`https://docs.google.com/spreadsheets/d/${spreadsheetId()}/edit`}
            target="_blank"
            rel="noreferrer"
          >
            Open Google Sheet ↗
          </a>
        </Show>
      </Show>
    </div>
  );
}

function Onboarding() {
  return (
    <div style={{ 'padding-top': '32px' }}>
      <div class="brand" style={{ 'font-size': '26px', 'justify-content': 'center', 'margin-bottom': '8px' }}>
        <img src={ICON} alt="" style={{ width: '36px', height: '36px' }} />
        LactaLog
      </div>
      <p class="muted center" style={{ 'margin-bottom': '20px' }}>
        Track feeds and pumped milk, stored in your own Google Sheet.
      </p>
      <div class="card">
        <h3>Getting started</h3>
        <SettingsForm showAdvanced={false} />
      </div>
    </div>
  );
}

/** Official Google "G" mark (4-color), for the sign-in button. */
function GoogleIcon() {
  return (
    <svg class="gmark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Refresh icon with 180deg rotational symmetry, so it spins without wobble. */
function RefreshIcon(props: { spinning?: boolean }) {
  return (
    <svg
      class={props.spinning ? 'spin' : ''}
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SettingsDialog(props: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Trigger class="icon-btn" title="Settings">
        <GearIcon />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay class="overlay" />
        <div class="dialog-positioner">
          <Dialog.Content class="dialog">
            <Dialog.Title>
              <h2>Settings</h2>
            </Dialog.Title>
            <Dialog.Description class="desc">Stored locally on this device only.</Dialog.Description>
            <SettingsForm showAdvanced={true} onSaved={() => props.onOpenChange(false)} />
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
