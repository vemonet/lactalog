import { createSignal, Show } from 'solid-js';
import { saveSettings, settings, spreadsheetId } from '../lib/storage';
import { refresh } from '../lib/data';
import { DateInput } from './DateInput';

export function SettingsForm(props: { onSaved?: () => void; showAdvanced?: boolean }) {
  const [url, setUrl] = createSignal(settings.spreadsheetUrl);
  const [birthDate, setBirthDate] = createSignal(settings.birthDate);
  const [birthWeight, setBirthWeight] = createSignal(String(settings.birthWeightKg));
  const [feedsPerDay, setFeedsPerDay] = createSignal(String(settings.feedsPerDay));
  const [feedingSheet, setFeedingSheet] = createSignal(settings.feedingSheet);
  const [milkingSheet, setMilkingSheet] = createSignal(settings.milkingSheet);
  const [sleepingSheet, setSleepingSheet] = createSignal(settings.sleepingSheet);
  // eslint-disable-next-line solid/reactivity -- initial value only
  const [adv, setAdv] = createSignal(props.showAdvanced ?? false);
  const [err, setErr] = createSignal('');

  function save(e: Event) {
    e.preventDefault();
    saveSettings({
      spreadsheetUrl: url().trim(),
      birthDate: birthDate(),
      birthWeightKg: parseFloat(birthWeight()) || 3.4,
      feedsPerDay: Math.max(0, parseInt(feedsPerDay(), 10) || 0),
      feedingSheet: feedingSheet().trim() || 'Feeding',
      milkingSheet: milkingSheet().trim() || 'Milking',
      sleepingSheet: sleepingSheet().trim() || 'Sleeping',
    });
    if (!spreadsheetId()) {
      setErr("That doesn't look like a valid Google Sheets URL.");
      return;
    }
    refresh();
    props.onSaved?.();
  }

  return (
    <form onSubmit={save}>
      <Show when={err()}>
        <div class="banner error">{err()}</div>
      </Show>

      <div class="field">
        <label>Google Sheets URL</label>
        <input
          class="input"
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
        <span class="muted" style={{ 'font-size': '12px' }}>
          Keep it private and <b>sign in with a Google account</b> that can edit it, or share it as "Anyone with the
          link" (charts load without sign-in; adding entries always needs sign-in).
        </span>
      </div>

      <div class="row">
        <div class="field">
          <label>Baby birth date</label>
          <DateInput value={birthDate()} onChange={setBirthDate} />
        </div>
        <div class="field">
          <label>Birth weight (kg)</label>
          <input
            class="input"
            type="number"
            step="0.1"
            value={birthWeight()}
            onInput={(e) => setBirthWeight(e.currentTarget.value)}
          />
        </div>
      </div>

      <Show when={adv()}>
        <div class="row">
          <div class="field">
            <label>Feeds per day (0 = auto by age)</label>
            <input
              class="input"
              type="number"
              min="0"
              value={feedsPerDay()}
              onInput={(e) => setFeedsPerDay(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Feeding sheet name</label>
            <input class="input" value={feedingSheet()} onInput={(e) => setFeedingSheet(e.currentTarget.value)} />
          </div>
          <div class="field">
            <label>Milking sheet name</label>
            <input class="input" value={milkingSheet()} onInput={(e) => setMilkingSheet(e.currentTarget.value)} />
          </div>
        </div>
        <div class="row">
          <div class="field">
            <label>Sleeping sheet name</label>
            <input class="input" value={sleepingSheet()} onInput={(e) => setSleepingSheet(e.currentTarget.value)} />
          </div>
        </div>
      </Show>

      <div class="row" style={{ 'margin-top': '8px' }}>
        <Show when={!props.showAdvanced}>
          <button type="button" class="btn ghost" onClick={() => setAdv(!adv())}>
            {adv() ? 'Hide advanced' : 'Advanced'}
          </button>
        </Show>
        <button class="btn" type="submit">
          Save
        </button>
      </div>
    </form>
  );
}
