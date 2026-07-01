import { createSignal, onMount, Show } from 'solid-js';
import { Tabs } from '@kobalte/core/tabs';
import { Dialog } from '@kobalte/core/dialog';
import { Feeding } from './pages/Feeding';
import { Milking } from './pages/Milking';
import { Sleeping } from './pages/Sleeping';
import { SettingsForm } from './components/SettingsForm';
import { error, loading, refresh } from './lib/data';
import { effectiveClientId, hasClientId, isConfigured, spreadsheetId } from './lib/storage';
import { authed, getAccessToken, signOut } from './lib/google';

const ICON = `${import.meta.env.BASE_URL}icon.svg`;

export function App() {
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [authError, setAuthError] = createSignal('');

  onMount(() => {
    if (isConfigured()) refresh();
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
                  <span class="gmark">G</span> <span class="chip-label">Sign in</span>
                </button>
              }
            >
              <button class="chip-btn signed" title="Signed in · click to sign out" onClick={signOut}>
                ✓ <span class="chip-label">Signed in</span>
              </button>
            </Show>
          </Show>
          <button class="icon-btn" title="Refresh" onClick={() => refresh()}>
            <span class={loading() ? 'spin' : ''}>⟳</span>
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

function SettingsDialog(props: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Trigger class="icon-btn" title="Settings">
        ⚙
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
