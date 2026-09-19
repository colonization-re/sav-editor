/** The five record panels. Each is a list-detail with a domain summary on top. */
import { COLONY, NATION_REC, SETTLEMENT, TRIBE, UNIT } from '../../../src/format/records.js';
import { GOODS, NATION } from '../../../src/format/enums.js';
import { store } from '../state.js';
import { h } from '../dom.js';
import { listPanel } from './list.js';
import { picker, section } from './overview.js';
import type { RecordValue } from '../fields.js';

const nationName = (n: number) => NATION[n] ?? `nation ${n}`;

export function coloniesPanel(): HTMLElement {
  const rows = store.save!.doc.colonies as RecordValue[];
  return listPanel({
    spec: COLONY,
    rows,
    empty: 'No colonies in this save.',
    summary: (c) => `${c.name || '(unnamed)'} - pop ${c.pop}, ${nationName(c.nation as number)}`,
    detailHead: (c, _i, redraw) => {
      const stock = c.stock as number[];
      return h('div', {},
        section('Colony',
          h('div', { class: 'col-row' },
            h('span', { class: 'sav-label' }, 'Name'),
            h('input', {
              type: 'text', class: 'col-input sav-input--sm sav-input--text',
              maxLength: 24, value: String(c.name),
              onchange: (e: Event) => { c.name = (e.target as HTMLInputElement).value; store.touch(); redraw(); },
            }),
            h('span', { class: 'sav-label' }, 'Owner'),
            picker(NATION, c.nation as number, (v) => { c.nation = v; store.touch(); redraw(); }),
            h('span', { class: 'sav-label' }, 'Population'),
            h('span', { class: 'col-chip' }, String(c.pop)),
            h('span', { class: 'sav-label' }, 'At'),
            h('span', { class: 'col-chip' }, `${c.x}, ${c.y}`),
          )),
        section('Warehouse',
          h('div', { class: 'sav-cells' }, ...stock.map((v, i) =>
            h('label', { class: 'sav-cell' },
              h('span', {}, GOODS[i] ?? String(i)),
              h('input', {
                type: 'number', class: 'col-input col-input--mono sav-input--xs',
                min: 0, max: 65535, value: String(v),
                onchange: (e: Event) => {
                  const n = Number((e.target as HTMLInputElement).value) || 0;
                  stock[i] = Math.min(65535, Math.max(0, Math.round(n)));
                  store.touch();
                },
              }))))),
      );
    },
  });
}

export function unitsPanel(): HTMLElement {
  const rows = store.save!.doc.units as RecordValue[];
  return listPanel({
    spec: UNIT,
    rows,
    summary: (u) => `type ${u.type} at ${u.x},${u.y} - ${nationName((u.flags as number) & 0x0f)}`,
    detailHead: (u, _i, redraw) => section('Unit',
      h('div', { class: 'col-row' },
        h('span', { class: 'sav-label' }, 'Type'),
        h('span', { class: 'col-chip' }, `${u.type}`),
        h('span', { class: 'sav-label' }, 'Owner'),
        // The owning nation is the LOW NIBBLE of the flags byte; the high nibble is a
        // separate flag set, so it has to be preserved rather than overwritten.
        picker(NATION, (u.flags as number) & 0x0f, (v) => {
          u.flags = ((u.flags as number) & 0xf0) | (v & 0x0f);
          store.touch(); redraw();
        }),
        h('span', { class: 'sav-label' }, 'At'),
        h('span', { class: 'col-chip' }, `${u.x}, ${u.y}`),
        h('span', { class: 'sav-label' }, 'Orders'),
        h('span', { class: 'col-chip' }, String(u.orders)),
      ),
      h('p', { class: 'col-hint' },
        'The owner lives in the low nibble of ', h('code', {}, 'flags'), '; the high nibble is a ',
        'separate flag set and is preserved when you change the owner here.')),
  });
}

export function nationsPanel(): HTMLElement {
  const rows = store.save!.doc.nations as RecordValue[];
  return listPanel({
    spec: NATION_REC,
    rows,
    summary: (n, i) => `${nationName(i)} - ${n.gold} gold, ${n.tax}% tax`,
    detailHead: (n) => {
      const money = (key: string, label: string, note: string) =>
        h('label', { class: 'col-row' },
          h('span', { class: 'sav-label sav-money-k' }, label),
          h('input', {
            type: 'number', class: 'col-input col-input--mono sav-input--sm sav-input--num',
            value: String(n[key]),
            onchange: (e: Event) => { n[key] = Math.round(Number((e.target as HTMLInputElement).value) || 0); store.touch(); },
          }),
          h('span', { class: 'col-hint' }, note));
      const prices = n.price as number[];
      return h('div', {},
        section('Treasury',
          money('gold', 'Gold', 'the game clamps this to 0..999,999 when it changes it'),
          money('kingChest', "King's chest", 'his balance, not a total: he spends 1800 per soldier'),
          money('netSaleRevenue', 'Net sale revenue', 'cumulative; written every turn and never read'),
          h('div', { class: 'col-row' },
            h('span', { class: 'sav-label' }, 'Tax %'),
            h('input', {
              type: 'number', class: 'col-input col-input--mono sav-input--xs',
              min: 0, max: 255, value: String(n.tax),
              onchange: (e: Event) => { n.tax = Math.min(255, Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0))); store.touch(); },
            }),
            h('span', { class: 'sav-label' }, 'Bells'), h('span', { class: 'col-chip' }, String(n.bells)),
            h('span', { class: 'sav-label' }, 'Crosses'),
            h('span', { class: 'col-chip' }, `${n.crosses} of ${n.crossesNeeded}`))),
        section('Europe prices',
          h('div', { class: 'sav-cells' }, ...prices.map((v, i) =>
            h('label', { class: 'sav-cell' },
              h('span', {}, GOODS[i] ?? String(i)),
              h('input', {
                type: 'number', class: 'col-input col-input--mono sav-input--xs',
                min: 0, max: 255, value: String(v),
                onchange: (e: Event) => {
                  prices[i] = Math.min(255, Math.max(0, Math.round(Number((e.target as HTMLInputElement).value) || 0)));
                  store.touch();
                },
              }))))),
      );
    },
  });
}

export function settlementsPanel(): HTMLElement {
  const rows = store.save!.doc.settlements as RecordValue[];
  return listPanel({
    spec: SETTLEMENT,
    rows,
    empty: 'No native settlements in this save.',
    summary: (s) => `${nationName(s.owner as number)} at ${s.x},${s.y} - size ${s.size}${s.mission ? ', mission' : ''}`,
  });
}

export function tribesPanel(): HTMLElement {
  const rows = store.save!.doc.tribes as RecordValue[];
  return listPanel({
    spec: TRIBE,
    rows,
    // Tribes are the native half of the nation index space, addressed as i - 4.
    summary: (t, i) => `${nationName(i + 4)} - level ${t.level}, ${t.muskets} muskets, ${t.horses} horses`,
  });
}
