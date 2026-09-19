/**
 * The master-detail shell shared by colonies, units, nations, settlements and tribes.
 *
 * The detail side is always the generic record editor, so every field of every record is
 * reachable -- including the unidentified ones. Panels add summaries on top, never
 * instead.
 */
import type { RecordSpec } from '../../../src/format/types.js';
import { recordEditor, type RecordValue } from '../fields.js';
import { clear, h } from '../dom.js';
import { store } from '../state.js';

export interface ListPanelOptions {
  spec: RecordSpec;
  rows: RecordValue[];
  /** One line per row in the list. */
  summary: (r: RecordValue, i: number) => string;
  /** Optional extra controls above the generic editor. */
  detailHead?: (r: RecordValue, i: number, redraw: () => void) => Node | null;
  empty?: string;
  readOnly?: ReadonlySet<string>;
}

export function listPanel(o: ListPanelOptions): HTMLElement {
  const root = h('div', { class: 'panel split' });
  const list = h('div', { class: 'list' });
  const detail = h('div', { class: 'detail' });
  root.append(list, detail);

  if (o.rows.length === 0) {
    detail.appendChild(h('p', { class: 'note' }, o.empty ?? 'Nothing of this kind in the save.'));
    return root;
  }

  let selected = 0;
  const filter = h('input', { type: 'search', class: 'filter', placeholder: `Filter ${o.rows.length}...` , oninput: () => renderList() });

  const renderList = () => {
    clear(list);
    list.appendChild(filter);
    const q = filter.value.trim().toLowerCase();
    o.rows.forEach((r, i) => {
      const text = o.summary(r, i);
      if (q && !text.toLowerCase().includes(q)) return;
      list.appendChild(h('button', {
        class: `list-item${i === selected ? ' on' : ''}`,
        onclick: () => { selected = i; renderList(); renderDetail(); },
      }, h('span', { class: 'list-i' }, String(i)), text));
    });
  };

  const renderDetail = () => {
    clear(detail);
    const r = o.rows[selected]!;
    const head = o.detailHead?.(r, selected, () => { renderList(); renderDetail(); });
    if (head) detail.appendChild(head);
    detail.appendChild(h('details', { class: 'more', open: !head },
      h('summary', {}, `All ${o.spec.size} bytes of ${o.spec.name} #${selected}`),
      recordEditor(o.spec, r, {
        onChange: () => { store.touch(); renderList(); },
        ...(o.readOnly ? { readOnly: o.readOnly } : {}),
      })));
  };

  renderList();
  renderDetail();
  return root;
}
