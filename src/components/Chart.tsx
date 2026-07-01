import { onCleanup, onMount, createEffect } from 'solid-js';
import {
  Chart,
  type ChartConfiguration,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(BarController, BarElement, DoughnutController, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

Chart.defaults.color = '#9aa0c7';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = 'system-ui, sans-serif';

export function ChartView(props: { config: ChartConfiguration; height?: number }) {
  let canvas!: HTMLCanvasElement;
  let chart: Chart | undefined;

  onMount(() => {
    chart = new Chart(canvas, props.config);
  });

  // Re-render on data/config change (cheap full update for our small datasets).
  createEffect(() => {
    const cfg = props.config;
    if (!chart) return;
    chart.data = cfg.data;
    if (cfg.options) chart.options = cfg.options;
    chart.update();
  });

  onCleanup(() => chart?.destroy());

  return (
    <div style={{ height: `${props.height ?? 220}px`, position: 'relative' }}>
      <canvas ref={canvas} />
    </div>
  );
}
