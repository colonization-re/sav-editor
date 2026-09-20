/**
 * The generic field editor, driven by the SAME `FieldSpec` tables the codec and the JSON
 * Schema come from.
 *
 * Nothing here knows what a colony is. Add a field to `src/format/records.ts` and it
 * appears in the UI, correctly typed, with its confidence and its notes -- which is the
 * property that keeps the editor from drifting from the format as the reverse engineering
 * advances.
 *
 * Unknown fields are shown, not hidden. About a third of the file has no established
 * meaning, and someone poking at `f0a` with the game open is how that changes.
 */
import { ENUMS } from '../../src/format/enums.js';
import { fieldSize, type Confidence, type FieldSpec, type RecordSpec } from '../../src/format/types.js';
import { h, hex } from './dom.js';

export type RecordValue = Record<string, unknown>;

const RANGE: Record<string, [number, number]> = {
  u8: [0, 255], i8: [-128, 127],
  u16: [0, 65535], i16: [-32768, 32767],
  u32: [0, 4294967295], i32: [-2147483648, 2147483647],
};

export interface FieldOptions {
  onChange: () => void;
  /** Fields the UI keeps in step itself; shown but not editable. */
  readOnly?: ReadonlySet<string>;
}

const CONF_TITLE: Record<Confidence, string> = {
  high: 'Established by a byte-verified reconstruction or a game resource.',
  medium: 'Few witnesses, or inferred. A working label.',
  unknown: 'Offset and width only. The name is just its offset.',
};

/** high reads as established, medium as provisional; unknown stays the neutral badge. */
const CONF_CLASS: Record<Confidence, string> = {
  high: 'col-badge col-badge--ok',
  medium: 'col-badge col-badge--warn',
  unknown: 'col-badge',
};

function label(f: FieldSpec): HTMLElement {
  return h('div', { class: 'col-prop-label' },
    h('span', { class: 'col-prop-name' }, f.name),
    h('span', { class: CONF_CLASS[f.confidence], title: CONF_TITLE[f.confidence] }, f.confidence),
    h('span', { class: 'col-meta', title: `${fieldSize(f)} byte(s) at this offset in the record` }, `+${hex(f.offset)}`),
  );
}

/** Render one field. Returns null for fields the caller chose to suppress. */
export function fieldRow(f: FieldSpec, rec: RecordValue, o: FieldOptions): HTMLElement {
  const ro = o.readOnly?.has(f.name) ?? false;
  const body =
    f.type === 'char' ? charInput(f, rec, o, ro)
    : f.type === 'bytes' ? bytesInput(f, rec, o, ro)
    : f.count !== undefined ? arrayInput(f, rec, o, ro)
    : scalarInput(f, rec, o, ro);

  return h('div', { class: `col-prop${f.confidence === 'unknown' ? ' col-prop--muted' : ''}` },
    label(f),
    h('div', {}, body),
    f.desc ? h('div', { class: 'col-prop-desc' }, f.desc) : null,
  );
}

function scalarInput(f: FieldSpec, rec: RecordValue, o: FieldOptions, ro: boolean): HTMLElement {
  const table = f.enum ? ENUMS[f.enum] : undefined;
  const value = rec[f.name] as number;

  if (table && !ro) {
    // A select, plus a number box -- the value may legitimately fall outside the table,
    // and an editor that refuses to show such a save is worse than one that shows a number.
    const sel = h('select', {
      class: 'col-select col-select--auto col-select--sm sav-select',
      onchange: () => { rec[f.name] = Number(sel.value); num.value = sel.value; o.onChange(); },
    }, ...Object.entries(table).map(([k, name]) =>
      h('option', { value: k, selected: Number(k) === value }, `${k} - ${name}`)));
    if (!(value in table)) {
      sel.appendChild(h('option', { value: String(value), selected: true }, `${value} - (not in table)`));
    }
    const num = numberBox(f, rec, o, ro, () => { sel.value = String(rec[f.name]); });
    return h('div', { class: 'col-row' }, sel, num);
  }
  return numberBox(f, rec, o, ro);
}

function numberBox(f: FieldSpec, rec: RecordValue, o: FieldOptions, ro: boolean, after?: () => void): HTMLInputElement {
  const [min, max] = RANGE[f.type] ?? [0, 255];
  const el = h('input', {
    type: 'number', class: 'col-input col-input--mono col-input--sm sav-input--num',
    min, max, step: 1, disabled: ro,
    value: String(rec[f.name] ?? 0),
    onchange: () => {
      const v = Math.round(Number(el.value));
      const c = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : 0;
      el.value = String(c);
      rec[f.name] = c;
      after?.();
      o.onChange();
    },
  });
  return el;
}

function charInput(f: FieldSpec, rec: RecordValue, o: FieldOptions, ro: boolean): HTMLElement {
  const width = fieldSize(f);
  const el = h('input', {
    type: 'text', class: 'col-input col-input--sm sav-input--text', maxLength: width, disabled: ro,
    value: String(rec[f.name] ?? ''),
    onchange: () => { rec[f.name] = el.value; o.onChange(); },
  });
  return h('div', { class: 'col-row' }, el, h('span', { class: 'col-hint' }, `max ${width} chars`));
}

function arrayInput(f: FieldSpec, rec: RecordValue, o: FieldOptions, ro: boolean): HTMLElement {
  const arr = rec[f.name] as number[];
  const table = f.enum ? ENUMS[f.enum] : undefined;
  const [min, max] = RANGE[f.type] ?? [0, 255];

  const grid = h('div', { class: 'col-cells' });
  arr.forEach((v, i) => {
    const input = h('input', {
      type: 'number', class: 'col-input col-input--mono col-input--xs',
      min, max, step: 1, disabled: ro, value: String(v),
      onchange: () => {
        const n = Math.round(Number(input.value));
        arr[i] = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
        input.value = String(arr[i]);
        o.onChange();
      },
    });
    grid.appendChild(h('label', { class: 'col-cell' },
      h('span', {}, table?.[i] ?? String(i)), input));
  });
  return grid;
}

/**
 * Raw bytes as hex. Editable, because for an unidentified block it is the only way in --
 * but strictly length-checked, since a short write here would shift the rest of the file.
 */
function bytesInput(f: FieldSpec, rec: RecordValue, o: FieldOptions, ro: boolean): HTMLElement {
  const width = fieldSize(f);
  const get = () => [...fromB64((rec[f.name] as { $b64: string }).$b64)]
    .map((b) => b.toString(16).padStart(2, '0')).join(' ');

  const err = h('span', { class: 'col-hint col-hint--error' });
  const el = h('textarea', {
    class: 'col-textarea col-input--mono sav-hex', rows: Math.min(6, Math.ceil(width / 16)), disabled: ro, spellcheck: false,
    value: get(),
    onchange: () => {
      const parts = el.value.trim().split(/[\s,]+/).filter(Boolean);
      if (parts.length !== width) {
        err.textContent = `need exactly ${width} bytes, got ${parts.length} - not applied`;
        el.value = get();
        return;
      }
      const out = new Uint8Array(width);
      for (let i = 0; i < width; i++) {
        const n = parseInt(parts[i]!, 16);
        if (!Number.isFinite(n) || n < 0 || n > 255) {
          err.textContent = `"${parts[i]}" is not a byte - not applied`;
          el.value = get();
          return;
        }
        out[i] = n;
      }
      err.textContent = '';
      (rec[f.name] as { $b64: string }).$b64 = toB64(out);
      o.onChange();
    },
  });
  return h('div', {}, el, err);
}

export function recordEditor(spec: RecordSpec, rec: RecordValue, o: FieldOptions): HTMLElement {
  const el = h('div', { class: 'col-props' });
  for (const f of spec.fields) el.appendChild(fieldRow(f, rec, o));
  return el;
}

export function toB64(b: Uint8Array): string {
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
