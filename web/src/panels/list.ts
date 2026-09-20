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
  /** Optional controls above the text filter. */
  controls?: (redraw: () => void) => Node | null;
  include?: (r: RecordValue, i: number) => boolean;
  sort?: (a: ListItem, b: ListItem) => number;
  /** Optional extra controls above the generic editor. */
  detailHead?: (r: RecordValue, i: number, redraw: () => void) => Node | null;
  empty?: string;
  filter?: boolean;
  readOnly?: ReadonlySet<string>;
}

export interface ListItem {
  r: RecordValue;
  i: number;
  text: string;
}

export function listPanel(o: ListPanelOptions): HTMLElement {
  const root = h('div', { class: 'sav-panel sav-panel--full sav-split sav-viewport' });
  const list = h('div', { class: 'sav-list' });
  const detail = h('div', { class: 'sav-detail' });
  root.append(list, detail);

  if (o.rows.length === 0) {
    detail.appendChild(h('p', { class: 'col-hint' }, o.empty ?? 'Nothing of this kind in the save.'));
    return root;
  }

  let selected = 0;
  const useFilter = o.filter ?? true;
  const redrawAll = () => { renderList(); renderDetail(); };
  const controls = o.controls?.(redrawAll);
  const filter = h('input', {
    type: 'search', class: 'col-input col-input--sm',
    placeholder: `Filter ${o.rows.length}...`, oninput: redrawAll,
  });
  const rows = h('div', { class: 'col-list' });
  if (controls) list.appendChild(controls);
  if (useFilter) list.appendChild(filter);
  list.appendChild(rows);

  const visibleRows = (): ListItem[] => {
    const q = useFilter ? filter.value.trim().toLowerCase() : '';
    const items: ListItem[] = [];
    o.rows.forEach((r, i) => {
      if (o.include && !o.include(r, i)) return;
      const text = o.summary(r, i);
      if (q && !text.toLowerCase().includes(q)) return;
      items.push({ r, i, text });
    });
    if (o.sort) items.sort(o.sort);
    return items;
  };

  const renderList = () => {
    clear(rows);
    const items = visibleRows();
    if (items.length === 0) {
      rows.appendChild(h('p', { class: 'col-hint sav-list-empty' }, 'No matching records.'));
      return;
    }
    if (!items.some((item) => item.i === selected)) selected = items[0]!.i;
    items.forEach(({ i, text }) => {
      rows.appendChild(h('button', {
        class: `col-list-item${i === selected ? ' is-active' : ''}`,
        'aria-selected': String(i === selected),
        onclick: () => { selected = i; redrawAll(); },
      }, h('span', { class: 'col-list-i' }, String(i)), text));
    });
  };

  const renderDetail = () => {
    clear(detail);
    if (visibleRows().length === 0) {
      detail.appendChild(h('p', { class: 'col-hint' }, 'No matching records.'));
      return;
    }
    const r = o.rows[selected]!;
    const head = o.detailHead?.(r, selected, () => { renderList(); renderDetail(); });
    if (head) detail.appendChild(head);
    detail.appendChild(h('details', { class: 'col-disclosure sav-disclosure', open: !head },
      h('summary', {}, `All ${o.spec.size} bytes of ${o.spec.name} #${selected}`),
      recordEditor(o.spec, r, {
        onChange: () => { store.touch(); redrawAll(); },
        ...(o.readOnly ? { readOnly: o.readOnly } : {}),
      })));
  };

  renderList();
  renderDetail();
  return root;
}
