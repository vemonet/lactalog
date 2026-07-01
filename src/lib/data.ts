import { createSignal } from 'solid-js';
import { fetchAll, type FeedingEntry, type MilkingEntry } from './sheets';

const [feeding, setFeeding] = createSignal<FeedingEntry[]>([]);
const [milking, setMilking] = createSignal<MilkingEntry[]>([]);
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal('');
const [loadedOnce, setLoadedOnce] = createSignal(false);

export { feeding, milking, loading, error, loadedOnce };

export async function refresh(): Promise<void> {
  setLoading(true);
  setError('');
  try {
    const { feeding: f, milking: m } = await fetchAll();
    // Newest first for tables; charts re-sort as needed.
    const byTime = (a: { date: string; time: string }, b: { date: string; time: string }) =>
      (b.date + b.time).localeCompare(a.date + a.time);
    setFeeding([...f].sort(byTime));
    setMilking([...m].sort(byTime));
    setLoadedOnce(true);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setLoading(false);
  }
}
