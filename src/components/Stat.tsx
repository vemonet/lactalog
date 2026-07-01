import type { JSX } from 'solid-js';

export function Stat(props: { value: JSX.Element; label: string; sub?: string }) {
  return (
    <div class="card stat">
      <span class="val">{props.value}</span>
      <span class="label">{props.label}</span>
      {props.sub && <span class="sub">{props.sub}</span>}
    </div>
  );
}
