/**
 * The editor, rendered.
 *
 * Every panel is built against both saves and every input is exercised, because the panels
 * are plain DOM and a typo in one of them is a runtime error the type checker cannot see.
 * The last test is the one that matters: after driving the UI, the document must still
 * serialize -- an editor that produces a file the codec cannot write is worse than useless.
 *
 * jsdom has no canvas, so `getContext` is stubbed with a recording no-op. That means the
 * map's DRAWING is not verified here, only that it runs and that its edits are correct.
 */
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../src/codec/savegame.js';
import { store } from '../web/src/state.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (n: string) => new Uint8Array(readFileSync(join(ROOT, 'saves', n)));

function stubCanvas(): void {
  // A no-op 2d context: enough for the map panel to run its draw loop.
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === 'canvas' ? {} : typeof k === 'string' && k.startsWith('create') ? () => ({}) : () => undefined),
    set: () => true,
  });
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 464, height: 576 }) as DOMRect;
}

async function panels() {
  const [{ overviewPanel }, recs, { mapPanel }, { rawPanel }] = await Promise.all([
    import('../web/src/panels/overview.js'),
    import('../web/src/panels/records.js'),
    import('../web/src/panels/map.js'),
    import('../web/src/panels/raw.js'),
  ]);
  return {
    overview: overviewPanel, map: mapPanel, raw: rawPanel,
    nations: recs.nationsPanel, colonies: recs.coloniesPanel,
    units: recs.unitsPanel, natives: recs.settlementsPanel, tribes: recs.tribesPanel,
  };
}

describe.each(['AUTO01.SAV', '_DECLARE.SAV'])('panels against %s', (file) => {
  beforeEach(() => {
    stubCanvas();
    store.open(file, load(file));
  });

  it('every panel renders without throwing, and produces controls', async () => {
    for (const [name, render] of Object.entries(await panels())) {
      const el = render();
      expect(el, name).toBeInstanceOf(HTMLElement);
      // A panel with no inputs at all is a panel that silently rendered nothing.
      const controls = el.querySelectorAll('input, select, textarea, button');
      expect(controls.length, `${name} has no controls`).toBeGreaterThan(0);
      expect(el.querySelector('.col-hint--error')?.textContent ?? '', `${name} rendered an error`).toBe('');
    }
  });

  it('the generic editor exposes every field of every record', async () => {
    const { colonies, units, nations } = await panels();
    const doc = store.save!.doc;
    if (doc.colonies.length > 0) {
      const names = [...colonies().querySelectorAll('.sav-field-name')].map((e) => e.textContent);
      // Unknown fields are shown, not hidden: that is the point of the panel.
      expect(names).toContain('bells');
      expect(names).toContain('f1d');
    }
    expect([...units().querySelectorAll('.sav-field-name')].map((e) => e.textContent)).toContain('cargoCount');
    expect([...nations().querySelectorAll('.sav-field-name')].map((e) => e.textContent)).toContain('gold');
  });

  it('survives driving every input, and still serializes', async () => {
    const before = serialize(store.save!.doc).length;
    for (const [name, render] of Object.entries(await panels())) {
      const el = render();
      document.body.appendChild(el);
      for (const input of el.querySelectorAll('input, select, textarea')) {
        // Fire change on everything as-is: values are unchanged, so this asserts the
        // handlers run and write back a value the codec still accepts.
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      expect(() => serialize(store.save!.doc), `${name} broke the document`).not.toThrow();
      el.remove();
    }
    expect(serialize(store.save!.doc).length).toBe(before);
  });
});

describe('editing through the UI', () => {
  beforeEach(() => { stubCanvas(); store.open('AUTO01.SAV', load('AUTO01.SAV')); });

  it('the date control writes year, season and turn together', async () => {
    const { overview } = await panels();
    const el = overview();
    const turn = el.querySelector<HTMLInputElement>('.col-row input[type="number"]')!;
    turn.value = '250';
    turn.dispatchEvent(new Event('change'));

    const g = store.save!.doc.globals as Record<string, number>;
    expect(g.turnCounter).toBe(250);
    // 250 is past the 1600 boundary: 108 + 2*71 = 250, so 1671 spring.
    expect(g.year).toBe(1671);
    expect(g.season).toBe(0);
    expect(() => serialize(store.save!.doc)).not.toThrow();
  });

  it('changing a unit owner keeps the high nibble of the flags byte', async () => {
    const { units } = await panels();
    const u = store.save!.doc.units[0] as Record<string, number>;
    u.flags = 0x25; // high nibble 2, nation 5
    const sel = units().querySelector<HTMLSelectElement>('.sav-sec select')!;
    sel.value = '3';
    sel.dispatchEvent(new Event('change'));
    expect(store.save!.doc.units[0]!.flags).toBe(0x23);
  });

  it('filters and sorts record lists with the tab-specific controls', async () => {
    const { colonies, units, natives } = await panels();

    const colonyRows = store.save!.doc.colonies as Array<Record<string, number | string>>;
    if (colonyRows.length > 0) {
      const el = colonies();
      const [nation, sort] = [...el.querySelectorAll<HTMLSelectElement>('.sav-list-tools select')];
      nation!.value = String(colonyRows[0]!.nation);
      nation!.dispatchEvent(new Event('change'));
      const colonyButtons = [...el.querySelectorAll<HTMLButtonElement>('.sav-list-item')];
      expect(colonyButtons.length).toBeGreaterThan(0);
      expect(colonyButtons.every((b) => colonyRows[Number(b.querySelector('.sav-list-i')!.textContent)]!.nation === colonyRows[0]!.nation)).toBe(true);

      nation!.value = 'all';
      nation!.dispatchEvent(new Event('change'));
      sort!.value = 'population';
      sort!.dispatchEvent(new Event('change'));
      const expected = colonyRows
        .map((r, i) => ({ i, pop: r.pop as number, name: String(r.name || '') }))
        .sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.i - b.i)[0]!.i;
      expect(Number(el.querySelector('.sav-list-item .sav-list-i')!.textContent)).toBe(expected);
    }

    const unitRows = store.save!.doc.units as Array<Record<string, number>>;
    const unitOwner = unitRows[0]!.flags & 0x0f;
    const unitsEl = units();
    const unitNation = unitsEl.querySelector<HTMLSelectElement>('.sav-list-tools select')!;
    unitNation.value = String(unitOwner);
    unitNation.dispatchEvent(new Event('change'));
    expect([...unitsEl.querySelectorAll<HTMLButtonElement>('.sav-list-item')]
      .every((b) => (unitRows[Number(b.querySelector('.sav-list-i')!.textContent)]!.flags & 0x0f) === unitOwner)).toBe(true);

    const nativeRows = store.save!.doc.settlements as Array<Record<string, number>>;
    if (nativeRows.length > 0) {
      const nativesEl = natives();
      const owner = nativesEl.querySelector<HTMLSelectElement>('.sav-list-tools select')!;
      owner.value = String(nativeRows[0]!.owner);
      owner.dispatchEvent(new Event('change'));
      expect([...nativesEl.querySelectorAll<HTMLButtonElement>('.sav-list-item')]
        .every((b) => nativeRows[Number(b.querySelector('.sav-list-i')!.textContent)]!.owner === nativeRows[0]!.owner)).toBe(true);
    }
  });

  it('a hex box refuses a wrong-length edit rather than shifting the file', async () => {
    const { raw } = await panels();
    const el = raw();
    document.body.appendChild(el);
    const box = el.querySelector<HTMLTextAreaElement>('.sav-hex')!;
    const original = box.value;
    box.value = 'ff ff';
    box.dispatchEvent(new Event('change'));
    expect(el.querySelector('.col-hint--error')!.textContent).toMatch(/need exactly/);
    expect(box.value).toBe(original);
    expect(serialize(store.save!.doc).length).toBe(store.save!.original.length);
    el.remove();
  });

  it('revert restores the original bytes', () => {
    (store.save!.doc.nations[0] as Record<string, number>).gold = 1;
    store.touch();
    expect(store.dirty).toBe(true);
    store.revert();
    expect(store.dirty).toBe(false);
    expect(store.build().changed).toBe(0);
  });
});
