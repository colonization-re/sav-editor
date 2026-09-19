/**
 * The load-bearing test: both sample saves must survive parse -> serialize unchanged.
 *
 * Byte-exactness is not a nicety here. The save has no checksum, so nothing downstream
 * would catch a codec that quietly dropped a field -- the game would just load a subtly
 * wrong world. This test is the only thing standing in that gap.
 *
 * The two saves are deliberately unalike: AUTO01 is turn 4 with one colony, _DECLARE is a
 * late game with 29 colonies and 277 units. They exercise every runtime-sized field.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from '../src/codec/savegame.js';
import { validateDocument } from '../src/validate.js';
import { RECORDS } from '../src/format/records.js';
import { fieldSize } from '../src/format/types.js';
import { dateFromTurn, turnFromDate } from '../src/format/calendar.js';

const SAVES = join(dirname(fileURLToPath(import.meta.url)), '..', 'saves');
const load = (n: string) => new Uint8Array(readFileSync(join(SAVES, n)));

const SAMPLES = [
  { file: 'AUTO01.SAV', bytes: 25585, colonies: 1, units: 95, settlements: 84, year: 1496, turn: 4, difficulty: 0 },
  { file: '_DECLARE.SAV', bytes: 35689, colonies: 29, units: 277, settlements: 48, year: 1716, turn: 340, difficulty: 2 },
] as const;

describe('record specs', () => {
  it('claim every byte of every record exactly once', () => {
    for (const spec of Object.values(RECORDS)) {
      let cursor = 0;
      for (const f of spec.fields) {
        expect(f.offset, `${spec.name}.${f.name} is not contiguous`).toBe(cursor);
        cursor += fieldSize(f);
      }
      expect(cursor, `${spec.name} coverage`).toBe(spec.size);
    }
  });
});

describe.each(SAMPLES)('$file', (s) => {
  const original = load(s.file);

  it('is the size we expect', () => {
    expect(original.length).toBe(s.bytes);
  });

  it('parses, and the layout consumes the file exactly', () => {
    // parse() throws on trailing bytes, so reaching here means the 57 fields summed to
    // the file size -- the same arithmetic that originally proved the layout.
    const doc = parse(original);
    expect(doc.header.version).toBe(0x49);
    expect(doc.colonies).toHaveLength(s.colonies);
    expect(doc.units).toHaveLength(s.units);
    expect(doc.settlements).toHaveLength(s.settlements);
    expect(doc.nations).toHaveLength(4);
    expect(doc.tribes).toHaveLength(8);
  });

  it('decodes the header consistently with the game', () => {
    const doc = parse(original);
    const g = doc.globals as Record<string, number>;
    expect(g.year).toBe(s.year);
    expect(g.turnCounter).toBe(s.turn);
    expect(g.difficulty).toBe(s.difficulty);
    // The stored year and season agree with what advance_turn computes from the turn
    // counter -- one turn a year to 1600, two a year after. Three independent words in
    // the file, and the game's own rule reconciles them in both saves.
    expect(dateFromTurn(g.turnCounter!)).toEqual({ year: g.year, season: g.season });
    // The record counts in the header block are what the array lengths came from.
    expect(g.colonyCount).toBe(s.colonies);
    expect(g.unitCount).toBe(s.units);
    expect(g.settlementCount).toBe(s.settlements);
  });

  it('round-trips byte-identically', () => {
    const doc = parse(original);
    const again = serialize(doc);
    expect(again.length).toBe(original.length);
    const at = again.findIndex((b, i) => b !== original[i]);
    expect(at, at === -1 ? '' : `first difference at 0x${at.toString(16)}`).toBe(-1);
  });

  it('survives a JSON round-trip too', () => {
    // The web editor will hand the document through JSON.stringify/parse, so the model
    // has to be plain JSON -- no typed arrays leaking through.
    const doc = JSON.parse(JSON.stringify(parse(original)));
    expect(serialize(doc)).toEqual(serialize(parse(original)));
  });

  it('validates against the generated schema', () => {
    const { valid, errors } = validateDocument(parse(original));
    expect(errors.slice(0, 5)).toEqual([]);
    expect(valid).toBe(true);
  });
});

describe('calendar', () => {
  it('round-trips turn <-> date across the 1600 boundary', () => {
    for (let t = 0; t < 600; t++) expect(turnFromDate(dateFromTurn(t))).toBe(t);
  });

  it('places the boundary where advance_turn does', () => {
    expect(dateFromTurn(0)).toEqual({ year: 1492, season: 0 });
    expect(dateFromTurn(107)).toEqual({ year: 1599, season: 0 });
    expect(dateFromTurn(108)).toEqual({ year: 1600, season: 0 });
    expect(dateFromTurn(109)).toEqual({ year: 1600, season: 1 });
    expect(dateFromTurn(110)).toEqual({ year: 1601, season: 0 });
  });
});

describe('editing', () => {
  it('an edited field reaches the bytes, and nothing else moves', () => {
    const original = load('AUTO01.SAV');
    const doc = parse(original);
    (doc.nations[0] as Record<string, number>).gold = 123456;
    const edited = serialize(doc);

    expect(edited.length).toBe(original.length);
    expect(parse(edited).nations[0]!.gold).toBe(123456);

    // Every changed byte lies inside that one field, and nowhere else in the file.
    // nations start at 0x0cb4 (write 10) and Nation.gold is at +0x2a, so 0x0cde..0x0ce1.
    // Fewer than four bytes may differ -- here the top byte was already zero.
    const GOLD = 0x0cb4 + 0x2a;
    const diffs = [...edited].flatMap((b, i) => (b === original[i] ? [] : [i]));
    expect(diffs.length).toBeGreaterThan(0);
    for (const i of diffs) expect(i, `byte 0x${i.toString(16)} moved`).toBeGreaterThanOrEqual(GOLD);
    for (const i of diffs) expect(i).toBeLessThan(GOLD + 4);
  });

  it('refuses a record count that disagrees with the header', () => {
    const doc = parse(load('AUTO01.SAV'));
    doc.units.pop();
    expect(() => serialize(doc)).toThrow(/unitCount/);
  });

  it('rejects a file that is not a save', () => {
    expect(() => parse(new Uint8Array(64))).toThrow(/not a Colonization save/);
  });
});
