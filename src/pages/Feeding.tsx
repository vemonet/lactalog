import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { ChartView } from '../components/Chart';
import { Stat } from '../components/Stat';
import { QtyInput } from '../components/QtyInput';
import { DateInput } from '../components/DateInput';
import { feeding, refresh } from '../lib/data';
import { addFeeding } from '../lib/sheets';
import { settings } from '../lib/storage';
import { computeExpected } from '../lib/expected';
import {
  avgDaily,
  bestDayTotal,
  longestGapMinutes,
  maxEntry,
  onDate,
  perDaySeries,
  timeOfDayBuckets,
  totalQty,
} from '../lib/stats';
import { fmtDateEU, humanDuration, nowHHMM, parseDateTime, pad2, round, todayISO } from '../lib/util';
import { notificationsActive, showNotify } from '../lib/notify';

const COW = '#f5a623';
const MOM = '#5cb3e6';
const BLUE = '#5cb3e6';
const BLUE_LIGHT = '#a7ddf3';
const TYPE_MOTHER = '🤱🏻 Mommy';
const TYPE_ARTIFICIAL = '🐮 Artificial';

export function Feeding() {
  const expected = createMemo(() => computeExpected(settings.birthDate, settings.birthWeightKg, settings.feedsPerDay));

  const [date, setDate] = createSignal(todayISO());
  const [time, setTime] = createSignal(nowHHMM());
  const [timeTouched, setTimeTouched] = createSignal(false);
  // Prefill the bottle size with the age-based recommendation (initial value only).
  // eslint-disable-next-line solid/reactivity
  const [qty, setQty] = createSignal(expected()?.perFeedMl ?? 60);
  const [qtyTouched, setQtyTouched] = createSignal(false);
  // Once data loads, prefill with the last recorded feed quantity (until the user edits it).
  createEffect(() => {
    const last = feeding()[0]; // sorted newest first
    if (!qtyTouched() && last) setQty(last.qty);
  });
  const [type, setType] = createSignal(TYPE_MOTHER);
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Ticking clock so the "next feed" section and the prefilled time stay live.
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 30_000);
  onCleanup(() => clearInterval(timer));
  createEffect(() => {
    if (!timeTouched()) setTime(nowHHMM(new Date(now())));
  });

  const today = todayISO();
  const todays = createMemo(() => onDate(feeding(), today));
  const todayTotal = createMemo(() => totalQty(todays()));

  // Next-feed recommendation based on the most recent feed + the age-based interval.
  const reminder = createMemo(() => {
    const last = feeding()[0]; // sorted newest first
    if (!last) return null;
    const lastDt = parseDateTime(last.date, last.time);
    if (Number.isNaN(lastDt.getTime())) return null;
    const intervalH = expected()?.intervalHours ?? 3;
    const nextMs = lastDt.getTime() + intervalH * 3_600_000;
    const nowMs = now();
    return {
      due: nowMs >= nextMs,
      dueIn: nextMs - nowMs,
      sinceLast: nowMs - lastDt.getTime(),
      nextHHMM: `${pad2(new Date(nextMs).getHours())}:${pad2(new Date(nextMs).getMinutes())}`,
      perFeed: expected()?.perFeedMl,
    };
  });

  // Fire a "miam time" notification when the next feed becomes due while the app
  // is open. Notify once per feed cycle, keyed by the most recent feed.
  let miamNotifiedKey = '';
  createEffect(() => {
    const r = reminder();
    if (!r || !notificationsActive()) return;
    const last = feeding()[0];
    const key = last ? `${last.date} ${last.time}` : '';
    if (r.due && key && key !== miamNotifiedKey) {
      miamNotifiedKey = key;
      void showNotify('🍼 Miam time!', {
        body: r.perFeed ? `Time to feed · suggested ~${r.perFeed} mL` : 'Time to feed',
        tag: 'miam',
        icon: `${import.meta.env.BASE_URL}icon.svg`,
        renotify: true,
      });
    }
  });

  async function submit(e: Event) {
    e.preventDefault();
    if (qty() <= 0) return;
    setSaving(true);
    setMsg(null);
    try {
      await addFeeding({ date: date(), time: time(), qty: qty(), type: type() });
      setMsg({ kind: 'ok', text: `Saved ${qty()} mL.` });
      setTime(nowHHMM());
      setTimeTouched(false);
      setQtyTouched(false);
      await refresh();
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  const perDay = createMemo(() => perDaySeries(feeding(), 14));
  const tod = createMemo(() => timeOfDayBuckets(feeding()));
  const split = createMemo(() => {
    let cow = 0;
    let mom = 0;
    for (const e of feeding()) {
      if (e.type === TYPE_ARTIFICIAL) cow += e.qty;
      else if (e.type === TYPE_MOTHER) mom += e.qty;
      else mom += e.qty; // default unknown labels to mother's bucket
    }
    const total = mom + cow;
    return {
      cow,
      mom,
      momPct: total ? Math.round((mom / total) * 100) : 0,
      cowPct: total ? Math.round((cow / total) * 100) : 0,
    };
  });

  return (
    <div class="grid">
      {/* ---- Next feed reminder ---- */}
      <Show when={reminder()}>
        {(r) => (
          <div class={`card reminder ${r().due ? 'due' : ''}`}>
            <div class="reminder-icon">{r().due ? '🍼' : '⏳'}</div>
            <div class="reminder-body">
              <Show
                when={r().due}
                fallback={
                  <div class="reminder-title">
                    Next feed in {humanDuration(r().dueIn)} <span class="muted">(~{r().nextHHMM})</span>
                  </div>
                }
              >
                <div class="reminder-title">Miam time{r().dueIn < -1800000 ? ' (overdue)' : ''}</div>
              </Show>
              <div class="muted" style={{ 'font-size': '13px' }}>
                Last feed {humanDuration(r().sinceLast)} ago
                <Show when={r().perFeed}> · suggested ~{r().perFeed} mL</Show>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* ---- Add entry ---- */}
      <form class="card" onSubmit={submit}>
        <h3>Add feeding session</h3>
        <Show when={msg()}>{(m) => <div class={`banner ${m().kind}`}>{m().text}</div>}</Show>
        <div class="row row-inline">
          <div class="field">
            <label>Date</label>
            <DateInput value={date()} onChange={setDate} />
          </div>
          <div class="field">
            <label>Time</label>
            <input
              class="input"
              type="time"
              value={time()}
              onInput={(e) => {
                setTime(e.currentTarget.value);
                setTimeTouched(true);
              }}
            />
          </div>
        </div>
        <div class="field">
          <label>Quantity (mL)</label>
          <QtyInput
            value={qty()}
            onChange={(v) => {
              setQty(v);
              setQtyTouched(true);
            }}
          />
        </div>
        <div class="field">
          <label>Type of milk</label>
          <div class="chips">
            <button
              type="button"
              class="chip"
              aria-pressed={type() === TYPE_MOTHER}
              onClick={() => setType(TYPE_MOTHER)}
            >
              {TYPE_MOTHER}
            </button>
            <button
              type="button"
              class="chip"
              aria-pressed={type() === TYPE_ARTIFICIAL}
              onClick={() => setType(TYPE_ARTIFICIAL)}
            >
              {TYPE_ARTIFICIAL}
            </button>
          </div>
        </div>
        <button class="btn" type="submit" disabled={saving()}>
          {saving() ? 'Saving...' : '🍼 Add feeding'}
        </button>
      </form>

      {/* ---- Expected intake ---- */}
      <Show
        when={expected()}
        fallback={
          <div class="card banner info" style={{ margin: 0 }}>
            Set the baby's birth date in Settings to see expected intake.
          </div>
        }
      >
        {(ex) => {
          const pct = () => Math.min(100, round((todayTotal() / ex().dailyMl) * 100));
          return (
            <div class="card">
              <h3>Expected today (guideline)</h3>
              <div class="expected">
                <div class="meta">
                  <div style={{ 'font-size': '22px', 'font-weight': 800 }}>
                    {todayTotal()} / {ex().dailyMl} mL
                  </div>
                  <div class="muted" style={{ margin: '6px 0' }}>
                    ~{ex().perFeedMl} mL × {ex().feeds} feeds
                    {ex().feedsAuto ? ' (auto by age)' : ''} · every ~{round(ex().intervalHours, 1)}h · {ex().note}
                  </div>
                  <div class="bar">
                    <span style={{ width: `${pct()}%` }} />
                  </div>
                </div>
              </div>
              <div class="muted" style={{ 'font-size': '12px', 'margin-top': '10px' }}>
                Rough guideline only, not medical advice. Follow your pediatrician.
              </div>
            </div>
          );
        }}
      </Show>

      {/* ---- Stats ---- */}
      <div class="grid cols-3">
        <Stat value={`${todayTotal()} mL`} label="Today total" />
        <Stat value={todays().length} label="Feeds today" />
        <Stat value={`${round(avgDaily(feeding(), 7))} mL`} label="Avg / day" sub="last 7 days" />
      </div>

      {/* ---- Records ---- */}
      <div class="section-title">Records</div>
      <div class="grid records">
        <Stat value={`${maxEntry(feeding())?.qty ?? 0} mL`} label="Biggest feed" />
        <Stat value={`${bestDayTotal(feeding())} mL`} label="Biggest day" />
        <Stat value={humanDuration(longestGapMinutes(feeding()) * 60_000)} label="Longest gap" />
      </div>

      <div class="section-title">Volume per day (14d)</div>
      <div class="card">
        <ChartView
          config={{
            type: 'bar',
            data: {
              labels: perDay().labels,
              datasets: [{ label: 'mL', data: perDay().values, backgroundColor: BLUE, borderRadius: 6 }],
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
          <h3>Source split</h3>
          <ChartView
            height={180}
            config={{
              type: 'doughnut',
              data: {
                labels: [TYPE_MOTHER, TYPE_ARTIFICIAL],
                datasets: [{ data: [split().mom, split().cow], backgroundColor: [MOM, COW], borderWidth: 0 }],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const v = ctx.parsed as number;
                        const total = split().mom + split().cow;
                        const p = total ? Math.round((v / total) * 100) : 0;
                        return `${ctx.label}: ${v} mL (${p}%)`;
                      },
                    },
                  },
                },
              },
            }}
          />
          <div class="legend">
            <div class="legend-item">
              <span class="dot" style={{ background: MOM }} />
              {TYPE_MOTHER}
              <span class="spacer" />
              <b>{split().momPct}%</b> <span class="muted">({split().mom} mL)</span>
            </div>
            <div class="legend-item">
              <span class="dot" style={{ background: COW }} />
              {TYPE_ARTIFICIAL}
              <span class="spacer" />
              <b>{split().cowPct}%</b> <span class="muted">({split().cow} mL)</span>
            </div>
          </div>
        </div>
        <div class="card">
          <h3>By time of day (all)</h3>
          <ChartView
            height={200}
            config={{
              type: 'bar',
              data: {
                labels: tod().labels,
                datasets: [{ label: 'mL', data: tod().values, backgroundColor: BLUE_LIGHT, borderRadius: 4 }],
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

      <div class="section-title">Recent feeds</div>
      <div class="card">
        <Show when={feeding().length > 0} fallback={<div class="muted center">No entries yet.</div>}>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>mL</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <For each={feeding().slice(0, 12)}>
                {(e) => (
                  <tr>
                    <td>{fmtDateEU(e.date)}</td>
                    <td>{e.time}</td>
                    <td>{e.qty}</td>
                    <td>{e.type}</td>
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
