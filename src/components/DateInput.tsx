import { createEffect, createSignal, untrack } from 'solid-js';
import { fmtDateEU } from '../lib/util';

// European date field: shows DD.MM.YYYY regardless of browser locale and lets
// you type it, while a calendar button opens the NATIVE date picker. Stores and
// emits an ISO YYYY-MM-DD string.
export function DateInput(props: { value: string; onChange: (iso: string) => void }) {
  let native!: HTMLInputElement;
  // Seed once; the createEffect below keeps it in sync afterwards.
  // eslint-disable-next-line solid/reactivity
  const [text, setText] = createSignal(props.value ? fmtDateEU(props.value) : '');

  // Reflect external value changes (e.g. reset to today) without a feedback loop.
  createEffect(() => {
    const ext = props.value ? fmtDateEU(props.value) : '';
    if (ext !== untrack(text)) setText(ext);
  });

  const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    const digits = e.currentTarget.value.replace(/\D/g, '').slice(0, 8);
    let s = digits;
    if (digits.length > 4) s = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) s = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setText(s);
    if (digits.length === 8) {
      props.onChange(`${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
    }
  };

  const openPicker = () => {
    try {
      native.showPicker();
    } catch {
      native.focus();
      native.click();
    }
  };

  return (
    <div class="date-field">
      <input class="input" type="text" inputmode="numeric" placeholder="dd.mm.yyyy" value={text()} onInput={onInput} />
      <button type="button" class="date-cal" aria-label="Pick a date" onClick={openPicker}>
        📅
      </button>
      <input
        ref={native}
        class="date-native"
        type="date"
        tabindex="-1"
        aria-hidden="true"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
      />
    </div>
  );
}
