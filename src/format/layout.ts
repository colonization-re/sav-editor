/**
 * The file, as the saver writes it: 57 fields in order.
 *
 * Derived from `save_game_to_file_1008_a7f6` (2,627 bytes, 57 calls to the write
 * forwarder) and cross-checked against `load_saved_game_1008_9056` (56 reads -- the
 * loader merges three contiguous runs). The two routes agree on every field's source
 * address and size. See win-decomp docs/formats/save-file.md and
 * docs/re_agent/save-layout-crosscheck.md.
 *
 * Seven of the 57 are runtime-sized: the three record arrays and the four map planes.
 * Everything else is a literal. That is why editing a count rewrites the whole file.
 */
import {
  BLOCK52,
  COLONY,
  GLOBALS,
  NATION_REC,
  REC6,
  SETTLEMENT,
  TRIBE,
  UNIT,
} from "./records.js";
import type { RecordSpec } from "./types.js";

/** Where a section's element count comes from. */
export type CountSource =
  | { readonly kind: "fixed"; readonly n: number }
  | {
      readonly kind: "global";
      readonly field: "unitCount" | "colonyCount" | "settlementCount";
    };

export type Section =
  /** A run of records, decoded field by field. */
  | {
      readonly kind: "array";
      readonly key: string;
      readonly spec: RecordSpec;
      readonly count: CountSource;
      readonly writes: string;
    }
  /** A single record, decoded field by field. */
  | {
      readonly kind: "struct";
      readonly key: string;
      readonly spec: RecordSpec;
      readonly writes: string;
    }
  /** A scalar we understand. */
  | {
      readonly kind: "scalar";
      readonly key: string;
      readonly type: "u16" | "i16" | "u32" | "i32" | "u8";
      readonly writes: string;
      readonly desc?: string;
    }
  /** Bytes we do not understand, carried verbatim as base64. */
  | {
      readonly kind: "blob";
      readonly key: string;
      readonly size: number;
      readonly writes: string;
      readonly desc?: string;
    }
  /** One of the four map planes: `mapWidth * mapHeight` bytes. */
  | {
      readonly kind: "plane";
      readonly index: 0 | 1 | 2 | 3;
      readonly writes: string;
    };

/** The magic the loader STRCMPs, including the trailing DOS end-of-file byte. */
export const MAGIC = "COLONIZE\0\x1a";

/**
 * The version word at +0x0a. The loader rejects anything that is not exactly this: it
 * branches separately on `>` (a save from a newer build) and `<` (an older one).
 * Both sample saves carry 0x49.
 */
export const SAVE_VERSION = 0x49;

/**
 * Writes 1-4 are the fixed 16-byte header, handled by the codec directly rather than as
 * sections, because the magic and the version are validated rather than merely carried.
 */
export const HEADER_SIZE = 0x10;

/**
 * Writes 5..57. The `writes` string cites the field number(s) in
 * win-decomp docs/formats/save-file.md, so every entry here stays traceable.
 */
export const SECTIONS: readonly Section[] = [
  { kind: "struct", key: "globals", spec: GLOBALS, writes: "5" },
  {
    kind: "array",
    key: "block52",
    spec: BLOCK52,
    count: { kind: "fixed", n: 4 },
    writes: "6",
  },
  {
    kind: "array",
    key: "rec6",
    spec: REC6,
    count: { kind: "fixed", n: 4 },
    writes: "7",
  },
  {
    kind: "array",
    key: "colonies",
    spec: COLONY,
    count: { kind: "global", field: "colonyCount" },
    writes: "8",
  },
  {
    kind: "array",
    key: "units",
    spec: UNIT,
    count: { kind: "global", field: "unitCount" },
    writes: "9",
  },
  {
    kind: "array",
    key: "nations",
    spec: NATION_REC,
    count: { kind: "fixed", n: 4 },
    writes: "10",
  },
  {
    kind: "array",
    key: "settlements",
    spec: SETTLEMENT,
    count: { kind: "global", field: "settlementCount" },
    writes: "11",
  },
  {
    kind: "array",
    key: "tribes",
    spec: TRIBE,
    count: { kind: "fixed", n: 8 },
    writes: "12",
  },

  {
    kind: "blob",
    key: "leaderFace",
    size: 0x0c,
    writes: "13",
    desc: "SEG20:0x7c18",
  },

  {
    kind: "scalar",
    key: "nationUnitCount",
    type: "i32",
    writes: "14",
    desc: "DGROUP:0x4b44",
  },
  {
    kind: "scalar",
    key: "long4b48",
    type: "i32",
    writes: "15",
    desc: "DGROUP:0x4b48",
  },
  {
    kind: "scalar",
    key: "long4b4c",
    type: "i32",
    writes: "16",
    desc: "DGROUP:0x4b4c",
  },
  {
    kind: "scalar",
    key: "long4b50",
    type: "i32",
    writes: "17",
    desc: "DGROUP:0x4b50",
  },
  {
    kind: "scalar",
    key: "long4b54",
    type: "i32",
    writes: "18",
    desc: "DGROUP:0x4b54",
  },
  {
    kind: "scalar",
    key: "long4b58",
    type: "i32",
    writes: "19",
    desc: "DGROUP:0x4b58",
  },
  {
    kind: "scalar",
    key: "long4b5c",
    type: "i32",
    writes: "20",
    desc: "DGROUP:0x4b5c",
  },
  {
    kind: "scalar",
    key: "long4b60",
    type: "i32",
    writes: "21",
    desc: "DGROUP:0x4b60",
  },

  {
    kind: "blob",
    key: "fleetStrength",
    size: 8,
    writes: "22",
    desc: "SEG20:0xd9d6, four words, one per European power.",
  },

  {
    kind: "scalar",
    key: "long4b64",
    type: "i32",
    writes: "23",
    desc: "DGROUP:0x4b64",
  },
  {
    kind: "scalar",
    key: "long4b68",
    type: "i32",
    writes: "24",
    desc: "DGROUP:0x4b68",
  },
  {
    kind: "scalar",
    key: "long4b6c",
    type: "i32",
    writes: "25",
    desc: "DGROUP:0x4b6c",
  },

  {
    kind: "blob",
    key: "unitTally",
    size: 0x4c,
    writes: "26",
    desc: "SEG20:0xd9de",
  },
  {
    kind: "blob",
    key: "regionSettlements",
    size: 0x10,
    writes: "27",
    desc: "SEG20:0xda60",
  },
  {
    kind: "blob",
    key: "regionFlags",
    size: 0x10,
    writes: "28",
    desc: "SEG20:0xdbf0",
  },
  {
    kind: "blob",
    key: "blockDa70",
    size: 0x40,
    writes: "29",
    desc: "SEG20:0xda70",
  },
  {
    kind: "blob",
    key: "navyTable",
    size: 0x40,
    writes: "30",
    desc: "SEG20:0xdab0",
  },
  {
    kind: "blob",
    key: "nationRegionStrength",
    size: 0x40,
    writes: "31",
    desc: "SEG20:0xdbb0",
  },
  {
    kind: "blob",
    key: "blockDaf0",
    size: 0x40,
    writes: "32",
    desc: "SEG20:0xdaf0",
  },
  {
    kind: "blob",
    key: "nationRegion",
    size: 0x40,
    writes: "33",
    desc: "SEG20:0xdb30",
  },
  {
    kind: "blob",
    key: "blockDb70",
    size: 0x40,
    writes: "34",
    desc: "SEG20:0xdb70",
  },
  {
    kind: "blob",
    key: "wordDa48",
    size: 8,
    writes: "35",
    desc: "SEG20:0xda48, four words.",
  },
  {
    kind: "blob",
    key: "byteC0e",
    size: 1,
    writes: "36",
    desc: "DGROUP:0x0c0e",
  },
  {
    kind: "blob",
    key: "tribeStrength",
    size: 8,
    writes: "37",
    desc: "SEG20:0xdc00, one byte per tribe.",
  },
  {
    kind: "blob",
    key: "tribePop",
    size: 8,
    writes: "38",
    desc: "SEG20:0xdc08, one byte per tribe.",
  },
  {
    kind: "blob",
    key: "tribeSettlementCount",
    size: 8,
    writes: "39",
    desc: "SEG20:0xdc10, one byte per tribe.",
  },
  {
    kind: "blob",
    key: "tribeRegion",
    size: 0x80,
    writes: "40",
    desc: "SEG20:0xdc18",
  },

  {
    kind: "scalar",
    key: "cursorX",
    type: "i16",
    writes: "41",
    desc: "DGROUP:0x4b30",
  },
  {
    kind: "scalar",
    key: "cursorY",
    type: "i16",
    writes: "42",
    desc: "DGROUP:0x4b32",
  },
  {
    kind: "scalar",
    key: "zoom",
    type: "i16",
    writes: "43",
    desc: "DGROUP:0x1c9a",
  },
  {
    kind: "scalar",
    key: "mapCenterX",
    type: "i16",
    writes: "44",
    desc: "DGROUP:0x1c92",
  },
  {
    kind: "scalar",
    key: "mapCenterY",
    type: "i16",
    writes: "45",
    desc: "DGROUP:0x1c94",
  },

  { kind: "plane", index: 0, writes: "46" },
  { kind: "plane", index: 1, writes: "47" },
  { kind: "plane", index: 2, writes: "48" },
  { kind: "plane", index: 3, writes: "49" },

  {
    kind: "blob",
    key: "blockSeg27_1bc",
    size: 0x10e,
    writes: "50",
    desc: "SEG27:0x1bc",
  },
  {
    kind: "blob",
    key: "blockSeg27_ae",
    size: 0x10e,
    writes: "51",
    desc: "SEG27:0x0ae",
  },
  {
    kind: "blob",
    key: "region25",
    size: 0x20,
    writes: "52",
    desc: "SEG20:0xda50, sixteen words.",
  },
  {
    kind: "blob",
    key: "blockSeg27_8c",
    size: 0x20,
    writes: "53",
    desc: "SEG27:0x08c, sixteen words.",
  },

  {
    kind: "blob",
    key: "uninitialisedStack",
    size: 4,
    writes: "54",
    desc:
      "A SHIPPED BUG. These four bytes come from a stack local the saver never assigns: it is " +
      "passed through an identity function, written, passed through again, and that is its whole " +
      "life. Every save carries whatever happened to be on the stack, so two saves of the same " +
      "game never compare equal. The loader reads them into a local of its own and discards them. " +
      "Carried verbatim; never compare two saves on this field.",
  },

  {
    kind: "blob",
    key: "seedBase",
    size: 4,
    writes: "55",
    desc: "DGROUP:0x4bc2",
  },
  {
    kind: "scalar",
    key: "scenerySeed",
    type: "i16",
    writes: "56",
    desc: "DGROUP:0x1ca6",
  },
  {
    kind: "blob",
    key: "routes",
    size: 0x378,
    writes: "57",
    desc:
      "SEG20:0xc804, 888 bytes. All zero in AUTO01.SAV -- it was long mistaken for end-of-file " +
      "padding, and its start offset falling exactly out of the write arithmetic is what proved " +
      "the 57-field chain correct.",
  },
];
