/** Overview: the header, the date, and the things people change first. */
import { dateFromTurn, turnFromDate } from '../../../src/format/calendar.js';
import { DIFFICULTY, GAME_FLAGS, NATION } from '../../../src/format/enums.js';
import { GLOBALS } from '../../../src/format/records.js';
import { recordEditor } from '../fields.js';
import { h } from '../dom.js';
import { store } from '../state.js';

export function overviewPanel(): HTMLElement {
  const save = store.save!;
  const doc = save.doc;
  const g = doc.globals as Record<string, number>;
  const touch = () => store.touch();

  const root = h('div', { class: 'panel' });

  root.appendChild(h('div', { class: 'cards' },
    stat('File', save.name, `${save.original.length.toLocaleString()} bytes`),
    stat('Version', `0x${doc.header.version.toString(16)}`, 'the only version this layout is known for'),
    stat('Map', `${doc.header.mapWidth} x ${doc.header.mapHeight}`, `${(doc.header.mapWidth * doc.header.mapHeight).toLocaleString()} tiles per plane`),
    stat('Records', `${doc.colonies.length} / ${doc.units.length} / ${doc.settlements.length}`, 'colonies / units / native settlements'),
  ));

  /* ---- the date ------------------------------------------------------------------
   * year, season and turnCounter are three separate words and the game keeps them in
   * step itself (advance_turn: one turn a year to 1600, two after). Editing one without
   * the others makes a save the game loads and then displays inconsistently, so this
   * writes all three from a single control. */
  const dateOut = h('span', { class: 'date-now' });
  const redraw = () => {
    const d = dateFromTurn(g.turnCounter!);
    const agrees = d.year === g.year && d.season === g.season;
    dateOut.textContent = `turn ${g.turnCounter} = ${d.year} ${d.season === 0 ? 'spring' : 'autumn'}`;
    dateOut.className = `date-now${agrees ? '' : ' warn'}`;
    if (!agrees) dateOut.textContent += `  (file says year ${g.year}, season ${g.season})`;
  };

  const turn = h('input', {
    type: 'number', class: 'f-num', min: 0, max: 65535, value: String(g.turnCounter),
    onchange: () => {
      const t = Math.max(0, Math.round(Number(turn.value) || 0));
      const d = dateFromTurn(t);
      g.turnCounter = t; g.year = d.year; g.season = d.season;
      turn.value = String(t);
      redraw(); touch();
    },
  });
  redraw();

  root.appendChild(section('Date',
    h('p', { class: 'note' },
      'The save stores year, season and turn as three separate words. This control writes all ',
      'three together, the way ', h('code', {}, 'advance_turn'), ' does: one turn per year until ',
      '1600, two per year after.'),
    h('div', { class: 'row' }, h('label', {}, 'Turn'), turn, dateOut),
  ));

  root.appendChild(section('Game',
    h('div', { class: 'row' },
      h('label', {}, 'You play'),
      picker(NATION, g.playerNation!, (v) => { g.playerNation = v; touch(); }),
      h('label', {}, 'Difficulty'),
      picker(DIFFICULTY, g.difficulty!, (v) => { g.difficulty = v; touch(); }),
    ),
    h('div', { class: 'row wrap' }, ...Object.entries(GAME_FLAGS).map(([name, mask]) =>
      h('label', { class: 'chk' },
        h('input', {
          type: 'checkbox', checked: (g.gameFlags! & mask) !== 0,
          onchange: (e: Event) => {
            const on = (e.target as HTMLInputElement).checked;
            g.gameFlags = on ? g.gameFlags! | mask : g.gameFlags! & ~mask;
            touch();
          },
        }),
        name, h('span', { class: 'f-off' }, `0x${mask.toString(16)}`)))),
    h('p', { class: 'note' },
      'Only the bits col-win-re has named are shown. The word is masked with several others ',
      'that nothing establishes the meaning of; edit those in the full field list below.'),
  ));

  const full = h('details', { class: 'more' },
    h('summary', {}, 'All 142 bytes of the globals block'),
    h('p', { class: 'note' },
      'A raw dump of SEG20:0x7782, so every global the reconstruction has named in that ',
      'range is a save field for free. Record counts are read-only here: changing one ',
      'without adding or removing the records would make the file unreadable.'),
    recordEditor(GLOBALS, doc.globals, {
      onChange: () => { redraw(); touch(); },
      readOnly: new Set(['unitCount', 'colonyCount', 'settlementCount']),
    }));
  root.appendChild(full);

  return root;
}

function stat(k: string, v: string, note: string): HTMLElement {
  return h('div', { class: 'card' },
    h('div', { class: 'card-k' }, k),
    h('div', { class: 'card-v' }, v),
    h('div', { class: 'card-n' }, note));
}

export function section(title: string, ...body: (Node | null)[]): HTMLElement {
  return h('section', { class: 'sec' }, h('h2', {}, title), ...body.filter(Boolean) as Node[]);
}

export function picker(table: Readonly<Record<number, string>>, value: number, set: (v: number) => void): HTMLSelectElement {
  const sel = h('select', { class: 'f-select', onchange: () => set(Number(sel.value)) },
    ...Object.entries(table).map(([k, name]) =>
      h('option', { value: k, selected: Number(k) === value }, `${k} - ${name}`)));
  if (!(value in table)) sel.appendChild(h('option', { value: String(value), selected: true }, `${value} - (not in table)`));
  return sel;
}
