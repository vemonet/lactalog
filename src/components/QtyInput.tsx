export function QtyInput(props: { value: number; onChange: (v: number) => void; step?: number }) {
  const step = () => props.step ?? 10;
  const clamp = (v: number) => Math.max(0, Math.round(v));
  return (
    <div class="qty-row">
      <button
        type="button"
        class="step-btn"
        aria-label="decrease"
        onClick={() => props.onChange(clamp(props.value - step()))}
      >
        -
      </button>
      <input
        class="input"
        type="number"
        inputmode="numeric"
        min="0"
        value={props.value}
        onInput={(e) => props.onChange(clamp(parseFloat(e.currentTarget.value) || 0))}
      />
      <button
        type="button"
        class="step-btn"
        aria-label="increase"
        onClick={() => props.onChange(clamp(props.value + step()))}
      >
        +
      </button>
    </div>
  );
}
