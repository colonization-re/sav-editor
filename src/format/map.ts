/**
 * The four map planes: decoding the bits, and a palette to draw them with.
 *
 * Shared core, no DOM -- the CLI and the browser editor both use it.
 *
 * Sources: col-win-re `docs/findings/map-planes.md` and `include/terrain.h`. Only what is
 * established is decoded here; plane 2's low nibble and plane 3's low nibble have no
 * reading and are exposed raw.
 */
import { TERRAIN } from './enums.js';

/* ---- plane 0: the terrain byte (terrain_from_map_byte, 1040:42b5) ---------------------- */

export const MAP0_TERRAIN_MASK = 0x1f;
/** Hills or mountains. When set, the low five bits are NOT a terrain id. */
export const MAP0_HILLY = 0x20;
export const MAP0_RIVER = 0x40;
/** With HILLY: mountains rather than hills. With RIVER: a major river. Same bit. */
export const MAP0_HIGH = 0x80;

export const TERRAIN_ARCTIC = 24;
export const TERRAIN_OCEAN = 25;
export const TERRAIN_SEA_LANE = 26;
export const TERRAIN_MOUNTAINS = 27;
export const TERRAIN_HILLS = 28;

export interface Terrain {
  /** The id to draw and name: the low five bits, or HILLS/MOUNTAINS when the hilly bit is set. */
  id: number;
  /** The raw low five bits, which are not a terrain id when `hilly`. */
  base: number;
  hilly: boolean;
  mountains: boolean;
  river: boolean;
  majorRiver: boolean;
  /**
   * Bit 7 raw. It is `mountains` with the hilly bit and `majorRiver` with the river bit --
   * but it also occurs with NEITHER set, where nothing establishes what it means. Kept so
   * that decode/encode is exact for all 256 values; editing a tile must not silently drop
   * a bit whose meaning we have not recovered.
   */
  high: boolean;
}

export function decodeTerrain(byte: number): Terrain {
  const base = byte & MAP0_TERRAIN_MASK;
  const hilly = (byte & MAP0_HILLY) !== 0;
  const river = (byte & MAP0_RIVER) !== 0;
  const high = (byte & MAP0_HIGH) !== 0;
  const mountains = hilly && high;
  return {
    id: hilly ? (mountains ? TERRAIN_MOUNTAINS : TERRAIN_HILLS) : base,
    base,
    hilly,
    mountains,
    river,
    majorRiver: river && !hilly && high,
    high,
  };
}

/** Rebuild a plane-0 byte. The inverse of `decodeTerrain` for every byte 0..255. */
export function encodeTerrain(t: Terrain): number {
  const high = t.hilly ? t.mountains : t.river ? t.majorRiver : t.high;
  return (
    (t.base & MAP0_TERRAIN_MASK) |
    (t.hilly ? MAP0_HILLY : 0) |
    (t.river ? MAP0_RIVER : 0) |
    (high ? MAP0_HIGH : 0)
  );
}

export function terrainName(t: Terrain): string {
  if (t.mountains) return 'Mountains';
  if (t.hilly) return 'Hills';
  const n = TERRAIN_FULL[t.id];
  return n ?? `Terrain ${t.id}`;
}

export function isWater(t: Terrain): boolean {
  return !t.hilly && (t.base === TERRAIN_OCEAN || t.base === TERRAIN_SEA_LANE);
}

/** All 29 ids. 16..23 repeat the names of 8..15; what tells the bands apart is not established. */
export const TERRAIN_FULL: Readonly<Record<number, string>> = {
  ...TERRAIN,
  16: 'Boreal Forest (2)', 17: 'Scrub Forest (2)', 18: 'Mixed Forest (2)',
  19: 'Broadleaf Forest (2)', 20: 'Conifer Forest (2)', 21: 'Tropical Forest (2)',
  22: 'Wetland Forest (2)', 23: 'Rain Forest (2)',
  24: 'Arctic', 25: 'Ocean', 26: 'Sea Lane', 27: 'Mountains', 28: 'Hills',
};

/**
 * Drawing colours. NOT from the game -- the real palette lives in the art files and is a
 * separate job (see the win-tools repo). These are chosen to make the map readable.
 */
export const TERRAIN_COLOUR: Readonly<Record<number, string>> = {
  0: '#b9b39a', 1: '#d9c48c', 2: '#a9bd78', 3: '#c3c96f', 4: '#7fae5a',
  5: '#95a548', 6: '#7d8c56', 7: '#5f6f47', 8: '#4a6b4a', 9: '#7a8b56',
  10: '#4f7a4a', 11: '#3f7040', 12: '#3c6b52', 13: '#2f6b41', 14: '#41705c',
  15: '#245c39',
  16: '#4a6b4a', 17: '#7a8b56', 18: '#4f7a4a', 19: '#3f7040', 20: '#3c6b52',
  21: '#2f6b41', 22: '#41705c', 23: '#245c39',
  24: '#e8eef2', 25: '#2f5f95', 26: '#3f7ab5', 27: '#8a8279', 28: '#a08c6a',
};

export function terrainColour(t: Terrain): string {
  return TERRAIN_COLOUR[t.id] ?? '#888888';
}

/* ---- plane 1: a bitfield (map_plane1_set_bits) ----------------------------------------- */

export const MAP1 = {
  unit: 0x01,
  settlement: 0x02,
  depleted: 0x04,
  road: 0x08,
  /** The native claim is settled -- land paid for, or taken. */
  claimSettled: 0x10,
  bit5: 0x20,
  plowed: 0x40,
} as const;

export const MAP1_LABELS: Readonly<Record<keyof typeof MAP1, string>> = {
  unit: 'Unit present',
  settlement: 'Settlement',
  depleted: 'Depleted resource',
  road: 'Road',
  claimSettled: 'Native claim settled',
  bit5: 'Bit 5 (unidentified)',
  plowed: 'Plowed',
};

/* ---- plane 2: a nation index in each nibble --------------------------------------------- */

/** The high-nibble reader maps 15 to -1. */
export const MAP2_NONE = 15;

/** The owning nation, or -1 for none. */
export function squareNation(byte: number): number {
  const n = (byte >> 4) & 0x0f;
  return n === MAP2_NONE ? -1 : n;
}

export function setSquareNation(byte: number, nation: number): number {
  const n = nation < 0 ? MAP2_NONE : nation & 0x0f;
  return (byte & 0x0f) | (n << 4);
}

/* ---- plane 3: a per-nation explored bitmask in the high nibble --------------------------- */

/**
 * Every caller that touches plane 3 computes `(1 << nation) << 4`, with nation taken from
 * an argument or from the current-nation global. Four bits, four European powers, and a
 * bitmask rather than an owner -- which is what a per-nation explored map looks like.
 * `reveal_around_colony` sets it over an 11x11 area, a sight radius rather than a worked one.
 */
export function exploredBy(byte: number, nation: number): boolean {
  return (byte & ((1 << nation) << 4)) !== 0;
}

export function setExploredBy(byte: number, nation: number, on: boolean): number {
  const mask = (1 << nation) << 4;
  return on ? byte | mask : byte & ~mask & 0xff;
}
