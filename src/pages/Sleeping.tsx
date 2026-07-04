import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { ChartView } from '../components/Chart';
import { Stat } from '../components/Stat';
import { DateInput } from '../components/DateInput';
import { sleeping, refresh } from '../lib/data';
import { addSleeping } from '../lib/sheets';
import { activeNap, clearNap, startNap } from '../lib/nap';
import {
  avgDaily,
  countPerDaySeries,
  longestGapMinutes,
  maxEntry,
  onDate,
  perDaySeries,
  timeOfDayBuckets,
  totalQty,
} from '../lib/stats';
import { fmtDateEU, fmtDuration, minutesBetween, nowHHMM, todayISO } from '../lib/util';
import { closeNotify, notificationsActive, showNotify } from '../lib/notify';

export function Sleeping() {
  const [date, setDate] = createSignal(todayISO());
  const [start, setStart] = createSignal(nowHHMM());
  const [startTouched, setStartTouched] = createSignal(false);
  const [end, setEnd] = createSignal(nowHHMM());
  const [endTouched, setEndTouched] = createSignal(false);
  const [manual, setManual] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Ticking clock so the "currently sleeping" elapsed time, and the prefilled
  // start/end fields, stay live.
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));
  createEffect(() => {
    if (!startTouched()) setStart(nowHHMM(new Date(now())));
  });
  createEffect(() => {
    if (!endTouched()) setEnd(nowHHMM(new Date(now())));
  });

  const duration = createMemo(() => minutesBetween(date(), start(), end()));
  const elapsed = createMemo(() => {
    const nap = activeNap();
    return nap ? minutesBetween(nap.date, nap.time, nowHHMM(new Date(now()))) : 0;
  });

  const today = todayISO();
  const todays = createMemo(() => onDate(sleeping(), today));

  // Returns whether the save succeeded, so callers can decide what to reset
  // (e.g. only clear the in-progress nap once it's actually been saved).
  async function save(entry: { date: string; time: string; endTime: string; qty: number }): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      await addSleeping(entry);
      setMsg({ kind: 'ok', text: `Saved ${fmtDuration(entry.qty)} of sleep.` });
      await refresh();
      return true;
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function wakeUp() {
    const nap = activeNap();
    if (!nap) return;
    const endTime = nowHHMM();
    const ok = await save({
      date: nap.date,
      time: nap.time,
      endTime,
      qty: minutesBetween(nap.date, nap.time, endTime),
    });
    if (ok) clearNap();
  }

  // Keep an ongoing notification (with a "Wake up" action button on Android)
  // while a nap is in progress; close it once the baby wakes up.
  createEffect(() => {
    const nap = activeNap();
    if (nap && notificationsActive()) {
      void showNotify('😴 Baby is sleeping', {
        body: `Started at ${nap.time}`,
        tag: 'nap',
        icon: `${import.meta.env.BASE_URL}icon.svg`,
        requireInteraction: true,
        silent: true,
        actions: [{ action: 'wake-up', title: 'Wake up' }],
      });
    } else {
      void closeNotify('nap');
    }
  });

  onMount(() => {
    // Cold start from the notification's "Wake up" action (no tab was open).
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'wake-up') {
      void wakeUp();
      window.history.replaceState({}, '', window.location.pathname);
    }
    // A "Wake up" tap relayed from the service worker to this open tab.
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; action?: string } | null;
      if (d?.type === 'notification-click' && d.action === 'wake-up') void wakeUp();
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    onCleanup(() => navigator.serviceWorker?.removeEventListener('message', onMsg));
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (duration() <= 0) return;
    const ok = await save({ date: date(), time: start(), endTime: end(), qty: duration() });
    if (ok) {
      setStart(nowHHMM());
      setStartTouched(false);
      setEnd(nowHHMM());
      setEndTouched(false);
    }
  }

  const perDay = createMemo(() => perDaySeries(sleeping(), 14));
  const sessions = createMemo(() => countPerDaySeries(sleeping(), 14));
  const tod = createMemo(() => timeOfDayBuckets(sleeping()));

  return (
    <div class="grid">
      <div class="card">
        <Show when={msg()}>{(m) => <div class={`banner ${m().kind}`}>{m().text}</div>}</Show>

        <Show
          when={activeNap()}
          fallback={
            <>
              <h3>Track sleep</h3>
              <button class="btn" type="button" onClick={startNap}>
                😴 Start sleeping
              </button>
              <button
                type="button"
                class="btn ghost"
                style={{ 'margin-top': '10px' }}
                onClick={() => setManual(!manual())}
              >
                {manual() ? 'Hide manual entry' : 'Log a past sleep manually'}
              </button>
            </>
          }
        >
          {(nap) => (
            <div class="reminder active">
              <div class="reminder-icon">😴</div>
              <div class="reminder-body">
                <div class="reminder-title">Sleeping for {fmtDuration(elapsed())}</div>
                <div class="muted" style={{ 'font-size': '13px' }}>
                  Started at {nap().time}
                </div>
              </div>
              <div class="reminder-actions">
                <button class="btn" type="button" style={{ width: 'auto' }} onClick={wakeUp} disabled={saving()}>
                  {saving() ? 'Saving...' : 'Wake up'}
                </button>
                <button class="btn ghost small" type="button" onClick={clearNap} disabled={saving()}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Show>
      </div>

      <Show when={!activeNap() && manual()}>
        <form class="card" onSubmit={submit}>
          <h3>Log a past sleep</h3>
          <div class="field">
            <label>Date</label>
            <DateInput value={date()} onChange={setDate} />
          </div>
          <div class="row">
            <div class="field">
              <label>Start</label>
              <input
                class="input"
                type="time"
                value={start()}
                onInput={(e) => {
                  setStart(e.currentTarget.value);
                  setStartTouched(true);
                }}
              />
            </div>
            <div class="field">
              <label>End</label>
              <input
                class="input"
                type="time"
                value={end()}
                onInput={(e) => {
                  setEnd(e.currentTarget.value);
                  setEndTouched(true);
                }}
              />
            </div>
          </div>
          <div class="muted" style={{ 'font-size': '13px', 'margin-bottom': '12px' }}>
            Duration: <b>{fmtDuration(duration())}</b>
          </div>
          <button class="btn" type="submit" disabled={saving() || duration() <= 0}>
            {saving() ? 'Saving...' : 'Add sleep'}
          </button>
        </form>
      </Show>

      <div class="grid cols-3">
        <Stat value={fmtDuration(totalQty(todays()))} label="Today total" />
        <Stat value={todays().length} label="Naps today" />
        <Stat value={fmtDuration(avgDaily(sleeping(), 7))} label="Avg / day" sub="last 7 days" />
      </div>

      <div class="section-title">Records</div>
      <div class="grid records">
        <Stat value={fmtDuration(maxEntry(sleeping())?.qty ?? 0)} label="Longest sleep" />
        <Stat value={fmtDuration(longestGapMinutes(sleeping()))} label="Longest awake gap" />
      </div>

      <div class="section-title">Sleep per day (14d)</div>
      <div class="card">
        <ChartView
          config={{
            type: 'bar',
            data: {
              labels: perDay().labels,
              datasets: [
                {
                  label: 'hours',
                  data: perDay().values.map((v) => Math.round((v / 60) * 10) / 10),
                  backgroundColor: '#9b8cf2',
                  borderRadius: 6,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true } },
            },
          }}
        />
      </div>

      <div class="grid cols-2">
        <div class="card">
          <h3>Naps per day (14d)</h3>
          <ChartView
            height={200}
            config={{
              type: 'bar',
              data: {
                labels: sessions().labels,
                datasets: [{ label: 'count', data: sessions().values, backgroundColor: '#c6bcf7', borderRadius: 4 }],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
              },
            }}
          />
        </div>
        <div class="card">
          <h3>By time of day (all)</h3>
          <ChartView
            height={200}
            config={{
              type: 'bar',
              data: {
                labels: tod().labels,
                datasets: [
                  {
                    label: 'hours',
                    data: tod().values.map((v) => Math.round((v / 60) * 10) / 10),
                    backgroundColor: '#7a67e0',
                    borderRadius: 4,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              },
            }}
          />
        </div>
      </div>

      <div class="section-title">Recent sleeps</div>
      <div class="card">
        <Show when={sleeping().length > 0} fallback={<div class="muted center">No entries yet.</div>}>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              <For each={sleeping().slice(0, 12)}>
                {(e) => (
                  <tr>
                    <td>{fmtDateEU(e.date)}</td>
                    <td>{e.time}</td>
                    <td>{e.endTime}</td>
                    <td>{fmtDuration(e.qty)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      </div>
    </div>
  );
}
