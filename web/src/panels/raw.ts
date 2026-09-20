/**
 * The remaining 41 top-level fields, most of them unidentified blocks.
 *
 * They are shown rather than hidden. This is roughly where the next findings will come
 * from -- diff two saves, see which block moved -- and an editor that hides what it does
 * not understand cannot help with that.
 */
import { SECTIONS } from '../../../src/format/layout.js';
import { h } from '../dom.js';
import { store } from '../state.js';
import { fromB64, toB64 } from '../fields.js';

export function rawPanel(): HTMLElement {
  const doc = store.save!.doc;
  const root = h('div', { class: 'sav-panel' });

  root.appendChild(h('p', { class: 'col-hint' },
    'Every top-level field that is not a record array or a map plane, in file order. ',
    'The write number cites col-win-re docs/formats/save-file.md. Most of these have no ',
    'established meaning and are carried through untouched.'));

  const table = h('div', { class: 'col-props' });
  for (const s of SECTIONS) {
    if (s.kind !== 'scalar' && s.kind !== 'blob') continue;
    const v = doc.state[s.key];

    const body = s.kind === 'scalar'
      ? h('input', {
          type: 'number', class: 'col-input col-input--mono col-input--sm sav-input--num',
          value: String(v),
          onchange: (e: Event) => { doc.state[s.key] = Math.round(Number((e.target as HTMLInputElement).value) || 0); store.touch(); },
        })
      : hexBox(s.key, s.size);

    table.appendChild(h('div', { class: 'col-prop' },
      h('div', { class: 'col-prop-label' },
        h('span', { class: 'col-prop-name' }, s.key),
        h('span', { class: 'col-meta' }, `write ${s.writes}`),
        s.kind === 'blob' ? h('span', { class: 'col-meta' }, `${s.size} B`) : null),
      h('div', {}, body),
      s.desc ? h('div', { class: 'col-prop-desc' }, s.desc) : null));
  }
  root.appendChild(table);
  return root;
}

function hexBox(key: string, size: number): HTMLElement {
  const doc = store.save!.doc;
  const get = () => [...fromB64((doc.state[key] as { $b64: string }).$b64)]
    .map((b) => b.toString(16).padStart(2, '0')).join(' ');

  const err = h('span', { class: 'col-hint col-hint--error' });
  const el = h('textarea', {
    class: 'col-textarea col-input--mono sav-hex', rows: Math.min(8, Math.ceil(size / 24)), spellcheck: false, value: get(),
    onchange: () => {
      const parts = el.value.trim().split(/[\s,]+/).filter(Boolean);
      if (parts.length !== size) {
        err.textContent = `need exactly ${size} bytes, got ${parts.length} - not applied`;
        el.value = get();
        return;
      }
      const out = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        const n = parseInt(parts[i]!, 16);
        if (!Number.isFinite(n) || n < 0 || n > 255) {
          err.textContent = `"${parts[i]}" is not a byte - not applied`;
          el.value = get();
          return;
        }
        out[i] = n;
      }
      err.textContent = '';
      doc.state[key] = { $b64: toB64(out) };
      store.touch();
    },
  });
  return h('div', {}, el, err);
}
