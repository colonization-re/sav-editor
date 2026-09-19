/**
 * The map planes.
 *
 * The planes travel through the document as base64, so the FILE round-trip cannot catch a
 * bad tile codec -- only these tests can. `encodeTerrain(decodeTerrain(b)) === b` for all
 * 256 bytes is the one that matters: editing a tile must not silently drop a bit whose
 * meaning has not been recovered. It caught exactly that, for bit 7 on a square that is
 * neither hilly nor river.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../src/codec/savegame.js';
import {
  decodeTerrain, encodeTerrain, exploredBy, isWater, setExploredBy,
  setSquareNation, squareNation, TERRAIN_OCEAN,
} from '../src/format/map.js';

const SAVES = join(dirname(fileURLToPath(import.meta.url)), '..', 'saves');
const planes = (n: string) => {
  const doc = parse(new Uint8Array(readFileSync(join(SAVES, n))));
  return doc.map.planes.map((p) => new Uint8Array(Buffer.from(p, 'base64')));
};

describe('plane 0 - terrain', () => {
  it('re-encodes every possible byte exactly', () => {
    for (let b = 0; b < 256; b++) expect(encodeTerrain(decodeTerrain(b)), `byte 0x${b.toString(16)}`).toBe(b);
  });

  it('reads the bits the way terrain.h documents them', () => {
    expect(decodeTerrain(0x04)).toMatchObject({ id: 4, hilly: false, river: false });
    expect(decodeTerrain(0x44)).toMatchObject({ id: 4, river: true, majorRiver: false });
    expect(decodeTerrain(0xc4)).toMatchObject({ id: 4, river: true, majorRiver: true });
    expect(decodeTerrain(0x20)).toMatchObject({ hilly: true, mountains: false, id: 28 });
    expect(decodeTerrain(0xa0)).toMatchObject({ hilly: true, mountains: true, id: 27 });
  });

  it('finds an ocean-dominated map in both saves', () => {
    for (const f of ['AUTO01.SAV', '_DECLARE.SAV']) {
      const p0 = planes(f)[0]!;
      expect(p0).toHaveLength(58 * 72);
      const water = [...p0].filter((b) => isWater(decodeTerrain(b))).length;
      expect(water / p0.length).toBeGreaterThan(0.5);
      expect([...p0].some((b) => decodeTerrain(b).base === TERRAIN_OCEAN)).toBe(true);
    }
  });
});

describe('plane 2 - square owner', () => {
  it('round-trips a nation index, and -1 for none', () => {
    for (let b = 0; b < 256; b++) {
      const n = squareNation(b);
      expect(setSquareNation(b, n)).toBe(b);
    }
    expect(squareNation(0xf0)).toBe(-1);
    expect(squareNation(setSquareNation(0, 3))).toBe(3);
  });
});

describe('plane 3 - the per-nation explored map', () => {
  it('round-trips a nation bit without touching the others', () => {
    for (let n = 0; n < 4; n++) {
      expect(exploredBy(setExploredBy(0, n, true), n)).toBe(true);
      expect(setExploredBy(setExploredBy(0xff, n, false), n, true)).toBe(0xff);
    }
  });

  it('grows enormously between an early and a late save', () => {
    // Turn 4 versus turn 340. reveal_around_colony sets a nation's bit over an 11x11 area
    // around each colony, so a long game with 29 colonies should have revealed most of the
    // map to its owner -- and does. Nothing else in this codebase predicts these numbers.
    const early = planes('AUTO01.SAV')[3]!;
    const late = planes('_DECLARE.SAV')[3]!;
    const seen = (p: Uint8Array, n: number) => [...p].filter((b) => exploredBy(b, n)).length;
    for (let n = 0; n < 4; n++) expect(seen(early, n)).toBeLessThan(200);
    expect(seen(late, 0)).toBeGreaterThan(3000);
    expect(seen(late, 0)).toBeLessThanOrEqual(late.length);
  });
});
