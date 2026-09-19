/**
 * The five record types the save file carries, plus the two header blocks.
 *
 * WHERE THE WIDTHS COME FROM, and why they are not guesses. The saver runs a byte-swap
 * pass over each array before writing it and another after (`colonies_swap_words`,
 * `units_swap_words`, `nations_swap_words`, `records_swap_words`, `records18_swap_words`,
 * `globals_swap_words`). Those helpers are IDENTITY on x86 -- vestiges of the big-endian
 * Mac build -- but they still had to enumerate every multi-byte field to swap it. So each
 * one is an exhaustive list of where the words and longs are, straight from the shipped
 * code. Everything they do not touch is bytes.
 *
 * That resolves several width disagreements left open in win-decomp's
 * docs/findings/struct-layouts.md, which merges declarations from many reconstructions:
 *   - Colony stock is SIXTEEN words at +0x9a (matching GOODS_COUNT), not 20/22/24.
 *   - Nation +0x14 and +0x48 are bytes, not words -- the swap pass skips them.
 *   - Unit has exactly two words, at +0x18 and +0x1a, and nothing else.
 *
 * NAMES come from win-decomp/docs/findings/struct-layouts.md, preferring the reading with
 * the most byte-verified witnesses. Anything unwitnessed keeps an `fNN` name; see
 * `completeRecord`, which invents those for every gap.
 */
import { completeRecord, type RecordSpec } from "./types.js";

/**
 * A unit: 28 bytes, `[SEG20:0x779e]` of them, from `SEG20:0xa208`.
 * Identified by its allocator, which owns the game's TOOMANYUNITS message and caps at 300.
 */
export const UNIT: RecordSpec = completeRecord({
  name: "Unit",
  size: 0x1c,
  desc: "One unit. Array length is header.globals.unitCount.",
  fields: [
    { name: "x", offset: 0x00, type: "u8", confidence: "high" },
    { name: "y", offset: 0x01, type: "u8", confidence: "high" },
    {
      name: "type",
      offset: 0x02,
      type: "u8",
      confidence: "high",
      desc: "Index into the 14-byte unit-type table at SEG20:0x7ac8.",
    },
    {
      name: "flags",
      offset: 0x03,
      type: "u8",
      confidence: "high",
      desc: "LOW NIBBLE is the owning nation (0..11, see NATION); the HIGH nibble is a flag set -- it takes only 0/1/2/4/8, which is what unit_nation_flag_set writing 0x10 << n produces.",
    },
    { name: "f04", offset: 0x04, type: "u8", confidence: "unknown" },
    {
      name: "f05",
      offset: 0x05,
      type: "u8",
      confidence: "unknown",
      desc: "Read as `moves` by 5 witnesses; not established.",
    },
    {
      name: "f06",
      offset: 0x06,
      type: "u8",
      confidence: "unknown",
      desc: "Read as a home-settlement index by a few witnesses; native_settlement_delete fixes this field up when a settlement dies, which supports it.",
    },
    { name: "mission", offset: 0x07, type: "u8", confidence: "medium" },
    { name: "orders", offset: 0x08, type: "u8", confidence: "high" },
    { name: "f09", offset: 0x09, type: "u8", confidence: "unknown" },
    { name: "f0a", offset: 0x0a, type: "u8", confidence: "unknown" },
    { name: "f0b", offset: 0x0b, type: "u8", confidence: "unknown" },
    { name: "cargoCount", offset: 0x0c, type: "u8", confidence: "high" },
    {
      name: "cargo",
      offset: 0x0d,
      type: "bytes",
      count: 10,
      confidence: "medium",
      desc: "The cargo hold, +0x0d..+0x16. HOW IT SPLITS IS CONTESTED: one reconstruction declares cargo[3] then amount[7], another a single cargo[10]. Kept as one run until the split is settled.",
    },
    {
      name: "spec",
      offset: 0x17,
      type: "u8",
      confidence: "medium",
      desc: "Profession/specialty (see JOBS) by 52 witnesses; 28 others call it `route`.",
    },
    {
      name: "link",
      offset: 0x18,
      type: "i16",
      confidence: "high",
      desc: "Stack chain. -1 in every record of both sample saves.",
    },
    {
      name: "link2",
      offset: 0x1a,
      type: "i16",
      confidence: "high",
      desc: "Second stack chain. -1 in every record of both sample saves.",
    },
  ],
});

/**
 * A colony: 202 bytes, `[SEG20:0x77a0]` of them, from `SEG20:0x7c28`.
 * Identified by its allocator, which owns TOOMANYCOLONIES and caps at 48.
 */
export const COLONY: RecordSpec = completeRecord({
  name: "Colony",
  size: 0xca,
  desc: "One colony. Array length is header.globals.colonyCount.",
  fields: [
    { name: "x", offset: 0x00, type: "u8", confidence: "high" },
    { name: "y", offset: 0x01, type: "u8", confidence: "high" },
    {
      name: "name",
      offset: 0x02,
      type: "char",
      count: 0x18,
      confidence: "high",
      desc: "NUL-padded, 24 bytes.",
    },
    {
      name: "nation",
      offset: 0x1a,
      type: "u8",
      confidence: "high",
      enum: "NATION",
    },
    {
      name: "aiState",
      offset: 0x1b,
      type: "u8",
      confidence: "medium",
      desc: "The AI's working byte; see win-decomp include/aicol.h.",
    },
    {
      name: "flags",
      offset: 0x1c,
      type: "u8",
      confidence: "high",
      desc: "Notification latches AND live economy state; see win-decomp include/colflag.h. Bits 0x02/0x04 are the Sons-of-Liberty production bonus.",
    },
    { name: "f1d", offset: 0x1d, type: "u8", confidence: "unknown" },
    { name: "f1e", offset: 0x1e, type: "u8", confidence: "unknown" },
    {
      name: "pop",
      offset: 0x1f,
      type: "i8",
      confidence: "high",
      desc: "Colonist count.",
    },
    {
      name: "jobs",
      offset: 0x20,
      type: "bytes",
      count: 0x20,
      confidence: "high",
      desc: "Per-colonist job, 32 slots; see JOBS. Ids below JOB_COLONIST are a building or tile reward.",
    },
    {
      name: "spec",
      offset: 0x40,
      type: "bytes",
      count: 0x20,
      confidence: "high",
      desc: "Per-colonist specialty, same id space as `jobs`.",
    },
    {
      name: "specnib",
      offset: 0x60,
      type: "bytes",
      count: 0x10,
      confidence: "medium",
      desc: "Sixteen bytes read as nibble pairs by 16 witnesses; what they hold is not established.",
    },
    {
      name: "slots",
      offset: 0x70,
      type: "bytes",
      count: 0x14,
      confidence: "high",
      desc: "Twenty tile/building work slots.",
    },
    {
      name: "flags2",
      offset: 0x84,
      type: "bytes",
      count: 0x0c,
      confidence: "unknown",
      desc: "A 12-byte region, +0x84..+0x8f. Witnesses subdivide it inconsistently (one reads +0x8d as export_goods); the byte-swap pass proves only that none of it is a word.",
    },
    { name: "changed", offset: 0x90, type: "u16", confidence: "medium" },
    { name: "hammers", offset: 0x92, type: "u16", confidence: "medium" },
    {
      name: "item",
      offset: 0x94,
      type: "u8",
      confidence: "medium",
      desc: "What the colony is currently building.",
    },
    { name: "warehouses", offset: 0x95, type: "u8", confidence: "medium" },
    { name: "fort", offset: 0x96, type: "u8", confidence: "medium" },
    { name: "mine", offset: 0x97, type: "u8", confidence: "medium" },
    { name: "f98", offset: 0x98, type: "u16", confidence: "unknown" },
    {
      name: "stock",
      offset: 0x9a,
      type: "u16",
      count: 16,
      confidence: "high",
      enum: "GOODS",
      desc: "Warehouse contents, indexed by goods id. Sixteen words -- the count comes from the byte-swap pass, not from a declaration.",
    },
    {
      name: "histPop",
      offset: 0xba,
      type: "bytes",
      count: 4,
      confidence: "medium",
    },
    {
      name: "histBld",
      offset: 0xbe,
      type: "bytes",
      count: 4,
      confidence: "medium",
    },
    {
      name: "bells",
      offset: 0xc2,
      type: "i32",
      confidence: "high",
      desc: "Liberty bells accumulated. The five witnesses that read BOTH longs put bells here and the cap at +0xc6; the 19 that name +0xc6 `bells` never saw this one.",
    },
    { name: "bellsCap", offset: 0xc6, type: "i32", confidence: "high" },
  ],
});

/**
 * A European nation: 316 bytes, always 4, from `SEG20:0xc2f4`.
 * The money fields are documented in detail in win-decomp/include/nations.h.
 */
export const NATION_REC: RecordSpec = completeRecord({
  name: "Nation",
  size: 0x13c,
  desc: "One European power. Always exactly four, indexed 0..3 (see NATION).",
  fields: [
    { name: "flags", offset: 0x00, type: "u8", confidence: "medium" },
    {
      name: "tax",
      offset: 0x01,
      type: "u8",
      confidence: "high",
      desc: "Tax rate, per cent.",
    },
    {
      name: "recruit",
      offset: 0x02,
      type: "bytes",
      count: 3,
      confidence: "high",
      desc: "The three colonists waiting on the Europe docks; JOBS ids.",
    },
    {
      name: "bells",
      offset: 0x0c,
      type: "u16",
      confidence: "high",
      desc: "Liberty bells toward the next founding father. `add_liberty` adds to this and to +0x0e both.",
    },
    { name: "bellsTotal", offset: 0x0e, type: "u16", confidence: "high" },
    { name: "f10", offset: 0x10, type: "u16", confidence: "unknown" },
    {
      name: "nextFather",
      offset: 0x12,
      type: "u16",
      confidence: "medium",
      desc: "The father currently being recruited; see FATHERS.",
    },
    {
      name: "fathers",
      offset: 0x14,
      type: "bytes",
      count: 2,
      confidence: "medium",
      desc: "Start of the founding-father bitset read by `nation_flag_test` -- father id IS the bit number. A BYTE field: the swap pass does not touch it, so it is not a word. How far the bitset runs past +0x15 is not established (25 fathers need 4 bytes).",
    },
    { name: "f16", offset: 0x16, type: "u16", confidence: "unknown" },
    { name: "artillery", offset: 0x1e, type: "u16", confidence: "medium" },
    {
      name: "boycott",
      offset: 0x20,
      type: "u16",
      confidence: "high",
      desc: "Bitmask of boycotted goods, one bit per GOODS id.",
    },
    {
      name: "kingChest",
      offset: 0x22,
      type: "i32",
      confidence: "high",
      desc: "The KING's balance for this nation: tax paid in, (difficulty*8+10) a turn, minus 1800 per regular/cavalry/gun he buys.",
    },
    {
      name: "netSaleRevenue",
      offset: 0x26,
      type: "i32",
      confidence: "high",
      desc: "Cumulative net sale revenue. Written every turn and never read.",
    },
    {
      name: "gold",
      offset: 0x2a,
      type: "i32",
      confidence: "high",
      desc: "YOUR GOLD. `nation_add_gold` clamps it to 0..999,999.",
    },
    {
      name: "crosses",
      offset: 0x2e,
      type: "u16",
      confidence: "high",
      desc: "Crosses toward the next immigrant -- NOT bells. Zeroed when it passes `crossesNeeded`.",
    },
    { name: "crossesNeeded", offset: 0x30, type: "u16", confidence: "high" },
    { name: "startX", offset: 0x32, type: "u8", confidence: "medium" },
    { name: "startY", offset: 0x33, type: "u8", confidence: "medium" },
    {
      name: "rel",
      offset: 0x34,
      type: "bytes",
      count: 4,
      confidence: "medium",
      desc: "Relations with the other European powers.",
    },
    { name: "founded", offset: 0x46, type: "u16", confidence: "unknown" },
    { name: "f48", offset: 0x48, type: "u8", confidence: "unknown" },
    {
      name: "f49",
      offset: 0x49,
      type: "u8",
      confidence: "unknown",
      desc: "Read as `muskets` and as `rebel` by one witness each.",
    },
    {
      name: "f4a",
      offset: 0x4a,
      type: "u16",
      confidence: "unknown",
      desc: "Read as `horses` by one witness.",
    },
    {
      name: "price",
      offset: 0x4c,
      type: "bytes",
      count: 16,
      confidence: "high",
      enum: "GOODS",
      desc: "Europe market price per goods id.",
    },
    {
      name: "volume",
      offset: 0x5c,
      type: "u16",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
      desc: "Per-goods market volume / price drift.",
    },
    {
      name: "traded",
      offset: 0x7c,
      type: "i32",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
    },
    {
      name: "taxPaid",
      offset: 0xbc,
      type: "i32",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
    },
    {
      name: "sold",
      offset: 0xfc,
      type: "i32",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
    },
  ],
});

/**
 * A native settlement: 18 bytes, `[SEG20:0x779c]` of them, from `SEG20:0xcb9a`.
 * Its allocator caps at 84 -- and the shipped AUTO01.SAV holds exactly 84.
 */
export const SETTLEMENT: RecordSpec = completeRecord({
  name: "Settlement",
  size: 0x12,
  desc: "One native settlement. Array length is header.globals.settlementCount.",
  fields: [
    { name: "x", offset: 0x00, type: "u8", confidence: "high" },
    { name: "y", offset: 0x01, type: "u8", confidence: "high" },
    {
      name: "owner",
      offset: 0x02,
      type: "u8",
      confidence: "high",
      enum: "NATION",
      desc: "The owning tribe, in the 0..11 nation index space (so 4..11 here).",
    },
    { name: "flags", offset: 0x03, type: "u8", confidence: "medium" },
    { name: "size", offset: 0x04, type: "u8", confidence: "medium" },
    { name: "mission", offset: 0x05, type: "u8", confidence: "medium" },
    { name: "f06", offset: 0x06, type: "u8", confidence: "unknown" },
    { name: "f07", offset: 0x07, type: "u8", confidence: "unknown" },
    { name: "f08", offset: 0x08, type: "u8", confidence: "unknown" },
    { name: "f09", offset: 0x09, type: "u8", confidence: "unknown" },
    {
      name: "alarm",
      offset: 0x0a,
      type: "u16",
      count: 4,
      confidence: "medium",
      desc: "Four words, one per European power.",
    },
  ],
});

/**
 * A tribe: 78 bytes, always 8, from `SEG20:0xd182`. The native half of the nation index
 * space, addressed as `i - 4`.
 */
export const TRIBE: RecordSpec = completeRecord({
  name: "Tribe",
  size: 0x4e,
  desc: "One native tribe. Always exactly eight, for nation indices 4..11.",
  fields: [
    { name: "x", offset: 0x00, type: "u8", confidence: "medium" },
    { name: "y", offset: 0x01, type: "u8", confidence: "medium" },
    { name: "level", offset: 0x02, type: "u8", confidence: "high" },
    { name: "f03", offset: 0x03, type: "u8", confidence: "unknown" },
    { name: "f04", offset: 0x04, type: "u8", confidence: "unknown" },
    { name: "count", offset: 0x05, type: "u8", confidence: "medium" },
    { name: "f06", offset: 0x06, type: "u8", confidence: "unknown" },
    { name: "muskets", offset: 0x07, type: "u8", confidence: "medium" },
    { name: "f08", offset: 0x08, type: "u8", confidence: "unknown" },
    { name: "f09", offset: 0x09, type: "u8", confidence: "unknown" },
    { name: "horses", offset: 0x0a, type: "u16", confidence: "medium" },
    { name: "f0c", offset: 0x0c, type: "u16", confidence: "unknown" },
    {
      name: "goodsDrift",
      offset: 0x0e,
      type: "u16",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
    },
    {
      name: "mood",
      offset: 0x2e,
      type: "u16",
      count: 4,
      confidence: "medium",
      desc: "One per European power. Banded at quarters of 100; see win-decomp include/tribes.h.",
    },
    {
      name: "b36",
      offset: 0x36,
      type: "bytes",
      count: 0x10,
      confidence: "unknown",
    },
    {
      name: "alarm",
      offset: 0x46,
      type: "u16",
      count: 4,
      confidence: "medium",
      desc: "One per European power.",
    },
  ],
});

/**
 * The 142-byte globals block, written straight from `SEG20:0x7782`.
 *
 * This is the best-named region of the whole file: because it is a raw dump of a
 * contiguous run of globals, EVERY global win-decomp has named in `SEG20:0x7782..0x780f`
 * is a save field for free, at `0x10 + (addr - 0x7782)`. The comments give each source
 * address so the mapping stays checkable.
 */
export const GLOBALS: RecordSpec = completeRecord({
  name: "Globals",
  size: 0x8e,
  desc: "The game-state globals block, a raw dump of SEG20:0x7782..0x780f.",
  fields: [
    {
      name: "tutorialFlags",
      offset: 0x00,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x7782",
    },
    {
      name: "gameFlags",
      offset: 0x02,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x7784. See GAME_FLAGS / win-decomp include/gameflag.h: 0x1 independence declared, 0x8 revolution won, 0x40 war begun.",
    },
    {
      name: "flags7786",
      offset: 0x04,
      type: "u16",
      confidence: "unknown",
      desc: "SEG20:0x7786",
    },
    {
      name: "scenarioFlags",
      offset: 0x06,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x7788. NOT byte-swapped by globals_swap_words -- the only word-aligned gap in the pass.",
    },
    {
      name: "f778a",
      offset: 0x08,
      type: "u16",
      confidence: "unknown",
      desc: "SEG20:0x778a",
    },
    {
      name: "year",
      offset: 0x0a,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x778c. 1492 + turnCounter in both sample saves.",
    },
    {
      name: "season",
      offset: 0x0c,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x778e. 0 = spring.",
    },
    {
      name: "turnCounter",
      offset: 0x0e,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x7790",
    },
    {
      name: "viewMode",
      offset: 0x10,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x7792",
    },
    {
      name: "selectedUnit",
      offset: 0x12,
      type: "i16",
      confidence: "high",
      desc: "SEG20:0x7794. -1 for none.",
    },
    {
      name: "turnNation",
      offset: 0x14,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x7796",
    },
    {
      name: "viewNation",
      offset: 0x16,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x7798",
    },
    {
      name: "playerNation",
      offset: 0x18,
      type: "u16",
      confidence: "high",
      enum: "NATION",
      desc: "SEG20:0x779a. Which of the four powers you are.",
    },
    {
      name: "settlementCount",
      offset: 0x1a,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x779c. Length of the 18-byte array. CHANGING THIS CHANGES THE FILE SIZE.",
    },
    {
      name: "unitCount",
      offset: 0x1c,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x779e. Length of the 28-byte array. Capped at 300 by the game.",
    },
    {
      name: "colonyCount",
      offset: 0x1e,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x77a0. Length of the 202-byte array. Capped at 48 by the game.",
    },
    {
      name: "tradeRouteCount",
      offset: 0x20,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77a2",
    },
    {
      name: "revealAll",
      offset: 0x22,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x77a4. The map-reveal cheat.",
    },
    {
      name: "viewOverride",
      offset: 0x24,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77a6",
    },
    {
      name: "difficulty",
      offset: 0x26,
      type: "u8",
      confidence: "high",
      enum: "DIFFICULTY",
      desc: "SEG20:0x77a8. 0 Discoverer .. 4 Viceroy.",
    },
    {
      name: "yearHi",
      offset: 0x27,
      type: "u8",
      confidence: "medium",
      desc: "SEG20:0x77a9",
    },
    {
      name: "yearLo",
      offset: 0x28,
      type: "u8",
      confidence: "medium",
      desc: "SEG20:0x77aa",
    },
    {
      name: "fatherOwner",
      offset: 0x29,
      type: "u8",
      confidence: "medium",
      desc: "SEG20:0x77ab",
    },
    {
      name: "gameInProgress",
      offset: 0x42,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77c4",
    },
    {
      name: "messageFlag",
      offset: 0x44,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77c6",
    },
    {
      name: "messagePending",
      offset: 0x46,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77c8",
    },
    {
      name: "warStarted",
      offset: 0x48,
      type: "u16",
      count: 4,
      confidence: "medium",
      desc: "SEG20:0x77ca, one per European power.",
    },
    {
      name: "rebelSentiment",
      offset: 0x50,
      type: "u16",
      confidence: "high",
      desc: "SEG20:0x77d2",
    },
    {
      name: "motherCountryIdx",
      offset: 0x52,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77d4",
    },
    {
      name: "f77d6",
      offset: 0x54,
      type: "u16",
      confidence: "unknown",
      desc: "SEG20:0x77d6",
    },
    {
      name: "mercNation",
      offset: 0x56,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77d8",
    },
    {
      name: "rebelStep",
      offset: 0x58,
      type: "u16",
      confidence: "medium",
      desc: "SEG20:0x77da",
    },
    {
      name: "royalForces",
      offset: 0x5a,
      type: "u16",
      count: 4,
      confidence: "high",
      desc: "SEG20:0x77dc. The King’s expeditionary force, multiplied by eight once the war begins.",
    },
    {
      name: "force",
      offset: 0x62,
      type: "u16",
      count: 4,
      confidence: "medium",
      desc: "SEG20:0x77e4",
    },
    {
      name: "baseSales",
      offset: 0x6a,
      type: "u16",
      count: 16,
      confidence: "medium",
      enum: "GOODS",
      desc: "SEG20:0x77ec",
    },
  ],
});

/**
 * Write 6: 208 bytes from `SEG20:0x7810`, passed to `nation52_swap_word_at_32` as four
 * 52-byte records with one word at +0x32.
 *
 * NOT NAMED, deliberately. A reconstruction (`compose_unit_icon`) places a 52-byte array
 * with a CONTROL byte at +1 (0 human, 1 computer, 2 defeated) at SEG20:0x7840 -- but
 * 0x7840 is 48 bytes into this block, which is not a multiple of 52, so the two readings
 * cannot both be right. Kept as four opaque records until that is settled.
 */
export const BLOCK52: RecordSpec = completeRecord({
  name: "Block52",
  size: 0x34,
  desc: "One of four 52-byte records from SEG20:0x7810. Contents unidentified.",
  fields: [{ name: "w32", offset: 0x32, type: "u16", confidence: "unknown" }],
});

/** Write 7: 24 bytes from `SEG20:0x78e0`, four 6-byte records of three words each. */
export const REC6: RecordSpec = completeRecord({
  name: "Rec6",
  size: 6,
  desc: "One of four 6-byte records from SEG20:0x78e0. Contents unidentified.",
  fields: [
    { name: "a", offset: 0, type: "u16", confidence: "unknown" },
    { name: "b", offset: 2, type: "u16", confidence: "unknown" },
    { name: "c", offset: 4, type: "u16", confidence: "unknown" },
  ],
});

export const RECORDS = {
  UNIT,
  COLONY,
  NATION_REC,
  SETTLEMENT,
  TRIBE,
  GLOBALS,
  BLOCK52,
  REC6,
} as const;
