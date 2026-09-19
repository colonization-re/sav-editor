/**
 * Value tables, transcribed from `win-decomp/include/*.h`.
 *
 * Those headers are themselves re-derived from the game's own TEXT resources by
 * `tools/check_headers.py`, so they are not guesses -- they are what the game calls
 * these things. Nothing here is ENFORCED by the schema: a save may legitimately hold a
 * value outside a table (the game itself has unused ids), and an editor that refuses to
 * open such a file is worse than one that shows the raw number. They exist for labels
 * and dropdowns.
 */

export type EnumTable = Readonly<Record<number, string>>;

/** goods.h -- the sixteen goods, indexing colony stock and every market array. */
export const GOODS: EnumTable = {
  0: "Food",
  1: "Sugar",
  2: "Tobacco",
  3: "Cotton",
  4: "Furs",
  5: "Lumber",
  6: "Ore",
  7: "Silver",
  8: "Horses",
  9: "Rum",
  10: "Cigars",
  11: "Cloth",
  12: "Coats",
  13: "Trade Goods",
  14: "Tools",
  15: "Muskets",
};

/** difficul.h -- the byte at SEG20:0x77a8. */
export const DIFFICULTY: EnumTable = {
  0: "Discoverer",
  1: "Explorer",
  2: "Conquistador",
  3: "Governor",
  4: "Viceroy",
};

/**
 * nations.h -- the twelve-value index space. 0..3 are the European powers (316-byte
 * records), 4..11 the native tribes (78-byte records, addressed as `i - 4`).
 * See win-decomp docs/findings/nation-index.md.
 */
export const NATION: EnumTable = {
  0: "England",
  1: "France",
  2: "Spain",
  3: "Netherlands",
  4: "Incas",
  5: "Aztecs",
  6: "Arawaks",
  7: "Iroquois",
  8: "Cherokee",
  9: "Apache",
  10: "Sioux",
  11: "Tupi",
};

/** fathers.h -- the index is also the bit number in a nation's founding-father bitset. */
export const FATHERS: EnumTable = {
  0: "Adam Smith",
  1: "Jakob Fugger",
  2: "Peter Minuit",
  3: "Peter Stuyvesant",
  4: "Jan de Witt",
  5: "Ferdinand Magellan",
  6: "Francisco de Coronado",
  7: "Hernando de Soto",
  8: "Henry Hudson",
  9: "La Salle",
  10: "Hernan Cortes",
  11: "George Washington",
  12: "Paul Revere",
  13: "Francis Drake",
  14: "John Paul Jones",
  15: "Thomas Jefferson",
  16: "Pocahontas",
  17: "Thomas Paine",
  18: "Simon Bolivar",
  19: "Benjamin Franklin",
  20: "William Brewster",
  21: "William Penn",
  22: "Jean de Brebeuf",
  23: "Juan de Sepulveda",
  24: "Bartolome de las Casas",
};

/** terrain.h -- the low five bits of a plane-0 byte, when the hilly bit is clear. */
export const TERRAIN: EnumTable = {
  0: "Tundra",
  1: "Desert",
  2: "Plains",
  3: "Prairie",
  4: "Grassland",
  5: "Savannah",
  6: "Marsh",
  7: "Swamp",
  8: "Boreal Forest",
  9: "Scrub Forest",
  10: "Mixed Forest",
  11: "Broadleaf Forest",
  12: "Conifer Forest",
  13: "Tropical Forest",
  14: "Wetland Forest",
  15: "Rain Forest",
  25: "Ocean",
};

/** gameflag.h -- bits of the game-state word at SEG20:0x7784. Only named bits appear. */
export const GAME_FLAGS: Readonly<Record<string, number>> = {
  independence: 0x0001,
  intervention: 0x0002,
  adviceGiven: 0x0004,
  revolutionWon: 0x0008,
  warBegun: 0x0040,
};

export const ENUMS: Readonly<Record<string, EnumTable>> = {
  GOODS,
  DIFFICULTY,
  NATION,
  FATHERS,
  TERRAIN,
};
