import { createMemo, createSignal, For, Show } from 'solid-js';
import { ChartView } from '../components/Chart';
import { Stat } from '../components/Stat';
import { QtyInput } from '../components/QtyInput';
import { DateInput } from '../components/DateInput';
import { milking, refresh } from '../lib/data';
import { addMilking } from '../lib/sheets';
import { avgDaily, countPerDaySeries, onDate, perDaySeries, timeOfDayBuckets, totalQty } from '../lib/stats';
import { fmtDateEU, nowHHMM, round, todayISO } from '../lib/util';

export function Milking() {
  const [date, setDate] = createSignal(todayISO());
  const [time, setTime] = createSignal(nowHHMM());
  const [qty, setQty] = createSignal(100);
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const today = todayISO();
  const todays = createMemo(() => onDate(milking(), today));

  async function submit(e: Event) {
    e.preventDefault();
    if (qty() <= 0) return;
    setSaving(true);
    setMsg(null);
    try {
      await addMilking({ date: date(), time: time(), qty: qty() });
      setMsg({ kind: 'ok', text: `Saved ${qty()} mL.` });
      setTime(nowHHMM());
      await refresh();
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  const perDay = createMemo(() => perDaySeries(milking(), 14));
  const sessions = createMemo(() => countPerDaySeries(milking(), 14));
  const tod = createMemo(() => timeOfDayBuckets(milking()));

  return (
    <div class="grid">
      <form class="card" onSubmit={submit}>
        <h3>Add pumping session</h3>
        <Show when={msg()}>{(m) => <div class={`banner ${m().kind}`}>{m().text}</div>}</Show>
        <div class="row row-inline">
          <div class="field">
            <label>Date</label>
            <DateInput value={date()} onChange={setDate} />
          </div>
          <div class="field">
            <label>Time</label>
            <input class="input" type="time" value={time()} onInput={(e) => setTime(e.currentTarget.value)} />
          </div>
        </div>
        <div class="field">
          <label>Quantity (mL)</label>
          <QtyInput value={qty()} onChange={setQty} />
        </div>
        <button class="btn" type="submit" disabled={saving()}>
          {saving() ? 'Saving...' : '⛽️ Add pumping'}
        </button>
      </form>

      <div class="grid cols-3">
        <Stat value={`${totalQty(todays())} mL`} label="Today total" />
        <Stat value={todays().length} label="Sessions today" />
        <Stat value={`${round(avgDaily(milking(), 7))} mL`} label="Avg / day" sub="last 7 days" />
      </div>

      <div class="section-title">Volume per day (14d)</div>
      <div class="card">
        <ChartView
          config={{
            type: 'bar',
            data: {
              labels: perDay().labels,
              datasets: [{ label: 'mL', data: perDay().values, backgroundColor: '#5cb3e6', borderRadius: 6 }],
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
          <h3>Sessions per day (14d)</h3>
          <ChartView
            height={200}
            config={{
              type: 'bar',
              data: {
                labels: sessions().labels,
                datasets: [{ label: 'count', data: sessions().values, backgroundColor: '#a7ddf3', borderRadius: 4 }],
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
                datasets: [{ label: 'mL', data: tod().values, backgroundColor: '#f5a623', borderRadius: 4 }],
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

      <div class="section-title">Recent sessions</div>
      <div class="card">
        <Show when={milking().length > 0} fallback={<div class="muted center">No entries yet.</div>}>
          <table class="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>mL</th>
              </tr>
            </thead>
            <tbody>
              <For each={milking().slice(0, 12)}>
                {(e) => (
                  <tr>
                    <td>{fmtDateEU(e.date)}</td>
                    <td>{e.time}</td>
                    <td>{e.qty}</td>
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
