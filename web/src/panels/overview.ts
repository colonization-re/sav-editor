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

  const root = h('div', { class: 'sav-panel' });

  root.appendChild(h('div', { class: 'col-tiles sav-tiles--compact' },
    stat('File', save.name, true, `${save.original.length.toLocaleString()} bytes`),
    stat('Version', `0x${doc.header.version.toString(16)}`, false, 'the only version this layout is known for'),
    stat('Map', `${doc.header.mapWidth} x ${doc.header.mapHeight}`, false, `${(doc.header.mapWidth * doc.header.mapHeight).toLocaleString()} tiles per plane`),
    stat('Records', `${doc.colonies.length} / ${doc.units.length} / ${doc.settlements.length}`, false, 'colonies / units / native settlements'),
  ));

  /* ---- the date ------------------------------------------------------------------
   * year, season and turnCounter are three separate words and the game keeps them in
   * step itself (advance_turn: one turn a year to 1600, two after). Editing one without
   * the others makes a save the game loads and then displays inconsistently, so this
   * writes all three from a single control. */
  const dateOut = h('span', { class: 'col-mono sav-ok' });
  const redraw = () => {
    const d = dateFromTurn(g.turnCounter!);
    const agrees = d.year === g.year && d.season === g.season;
    dateOut.textContent = `turn ${g.turnCounter} = ${d.year} ${d.season === 0 ? 'spring' : 'autumn'}`;
    dateOut.className = `col-mono ${agrees ? 'sav-ok' : 'sav-warn'}`;
    if (!agrees) dateOut.textContent += `  (file says year ${g.year}, season ${g.season})`;
  };

  const turn = h('input', {
    type: 'number', class: 'col-input col-input--mono sav-input--sm sav-input--num',
    min: 0, max: 65535, value: String(g.turnCounter),
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
    h('div', { class: 'col-row' }, h('span', { class: 'sav-label' }, 'Turn'), turn, dateOut),
    h('details', { class: 'sav-inline-disclosure' },
      h('summary', {}, 'How the date is stored'),
      h('p', { class: 'col-hint' },
        'The save stores year, season and turn as three separate words. This control writes all ',
        'three together, the way ', h('code', {}, 'advance_turn'), ' does: one turn per year until ',
        '1600, two per year after.')),
  ));

  root.appendChild(section('Game',
    h('div', { class: 'col-row' },
      h('span', { class: 'sav-label' }, 'You play'),
      picker(NATION, g.playerNation!, (v) => { g.playerNation = v; touch(); }, nationOption),
      h('span', { class: 'sav-label' }, 'Difficulty'),
      picker(DIFFICULTY, g.difficulty!, (v) => { g.difficulty = v; touch(); }),
    ),
    h('details', { class: 'sav-inline-disclosure' },
      h('summary', {}, 'Game flags'),
      h('div', { class: 'col-row sav-check-row' }, ...Object.entries(GAME_FLAGS).map(([name, mask]) =>
        h('label', { class: 'col-check' },
          h('input', {
            type: 'checkbox', checked: (g.gameFlags! & mask) !== 0,
            onchange: (e: Event) => {
              const on = (e.target as HTMLInputElement).checked;
              g.gameFlags = on ? g.gameFlags! | mask : g.gameFlags! & ~mask;
              touch();
            },
          }),
          h('span', {}, name, ' ', h('span', { class: 'sav-meta' }, `0x${mask.toString(16)}`))))),
      h('p', { class: 'col-hint' },
        'Only the bits col-win-re has named are shown. The word is masked with several others ',
        'that nothing establishes the meaning of; edit those in the full field list below.')),
  ));

  const full = h('details', { class: 'sav-disclosure' },
    h('summary', {}, 'All 142 bytes of the globals block'),
    h('p', { class: 'col-hint' },
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

/** `text` sizes the value for a file name rather than a figure. */
function stat(k: string, v: string, text: boolean, note: string): HTMLElement {
  return h('div', { class: 'col-tile' },
    h('div', { class: 'col-tile-k' }, k),
    h('div', { class: `col-tile-v${text ? ' sav-tile-v--text' : ''}` }, v),
    h('div', { class: 'col-tile-d' }, note));
}

export function section(title: string, ...body: (Node | null)[]): HTMLElement {
  return h('section', { class: 'col-card sav-sec' },
    h('h2', { class: 'col-eyebrow' }, title), ...body.filter(Boolean) as Node[]);
}

function nationOption(k: number, name: string): string {
  const emoji = ({
    0: '🇬🇧',
    1: '🇫🇷',
    2: '🇪🇸',
    3: '🇳🇱',
  } as Record<number, string>)[k] ?? '•';
  return `${emoji} ${name} (${k})`;
}

export function picker(
  table: Readonly<Record<number, string>>,
  value: number,
  set: (v: number) => void,
  label: (k: number, name: string) => string = (k, name) => `${k} - ${name}`,
): HTMLSelectElement {
  const sel = h('select', { class: 'col-select sav-select--auto', onchange: () => set(Number(sel.value)) },
    ...Object.entries(table).map(([k, name]) =>
      h('option', { value: k, selected: Number(k) === value }, label(Number(k), name))));
  if (!(value in table)) sel.appendChild(h('option', { value: String(value), selected: true }, `${value} - (not in table)`));
  return sel;
}
