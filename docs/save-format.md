# The `.SAV` format

_Colonization for Windows_, save version `0x49`. This describes what the code in `src/format/`
encodes, and cites where each claim comes from so it stays checkable.

Everything here derives from the [win-decomp](https://github.com/colonization-re) reconstruction,
principally `docs/formats/save-file.md` (the 57 write calls in `save_game_to_file_1008_a7f6`) and
`docs/re_agent/save-layout-crosscheck.md` (the same layout re-derived from the 56 read calls in
`load_saved_game_1008_9056`). **The two routes agree on every field's source address and size.**

## The five facts that shape the editor

1. **There is no checksum.** The loader validates exactly two things: a `STRCMP` of the ten-byte
   magic, and the version word. Nothing else is verified, so an edited save loads.
2. **It is little-endian.** The saver looks like it byte-swaps — every block is wrapped in a
   swap / write / swap-back sandwich — but `swap_word_identity` is a 21-byte function whose whole
   body is `return a;`, and the 32-bit helper likewise. They are vestiges of the shared
   big-endian Mac source. Nothing is swapped on the Windows build.
3. **Those same swap helpers are an authoritative width map.** To swap a record they had to
   enumerate every word and long in it, so `colonies_swap_words`, `units_swap_words`,
   `nations_swap_words`, `records_swap_words` and `records18_swap_words` between them say exactly
   where the multi-byte fields are. Everything they skip is bytes. This settles several width
   questions left open by the merged declarations in win-decomp's `struct-layouts.md` —
   see [Widths](#widths-settled-by-the-swap-pass).
4. **Seven of the 57 fields are runtime-sized**, so the file length varies: three record arrays
   and four map planes. Editing a count moves every byte after it, which is why this library
   re-serializes the whole file rather than patching in place.
5. **Four bytes are uninitialized stack.** See [The bug at `0x606f`](#the-bug-at-0x606f).

## Overall shape

| offset   | bytes                  | what                                                                               |
| -------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `0x0000` | 10                     | magic `COLONIZE\0` + `0x1a` (a DOS EOF byte, so `TYPE SAVE.SAV` stops at line one) |
| `0x000a` | 2                      | version word — must be `0x49`                                                      |
| `0x000c` | 4                      | map width, map height (two words; `58 × 72` in both known saves)                   |
| `0x0010` | 142                    | the globals block                                                                  |
| `0x009e` | 208                    | four 52-byte records, unidentified                                                 |
| `0x016e` | 24                     | four 6-byte records, unidentified                                                  |
| `0x0186` | `colonyCount × 202`    | colonies                                                                           |
| …        | `unitCount × 28`       | units                                                                              |
| …        | 1264                   | four 316-byte European nation records                                              |
| …        | `settlementCount × 18` | native settlements                                                                 |
| …        | 624                    | eight 78-byte tribe records                                                        |
| …        | ~1130                  | 33 assorted scalars and blocks                                                     |
| …        | `4 × width × height`   | the four map planes                                                                |
| …        | ~1470                  | the tail, ending in 888 bytes of trade routes                                      |

The loader makes 56 calls where the saver makes 57 because it reads three contiguous runs in one
call — including the first ten bytes, which it reads into a stack local in order to _validate_
rather than keep.

## The globals block is free naming

Write 5 is a raw dump of `SEG20:0x7782`, so every global win-decomp has named in
`0x7782..0x780f` is a save field at:

```
file offset = 0x10 + (SEG20 address - 0x7782)
```

That is where `year`, `season`, `turnCounter`, `difficulty`, `playerNation`, `revealAll` and the
three record counts come from. The same trick applies to the other blocks, which is how the tail
got its names.

Verified against `AUTO01.SAV`: the counts land at `0x2a/0x2c/0x2e` reading 84/95/1, exactly as the
win-decomp write table predicts.

## The calendar cross-check

`year`, `season` and `turnCounter` are three separate words. `advance_turn_1008_29b4` reconciles
them: the year rises one per turn until 1600, and from 1600 the season alternates so the year
moves every _second_ turn. A new game starts at 1492, turn 0, spring.

Both sample saves satisfy that rule exactly — `AUTO01` at turn 4 is 1496, and `_DECLARE` at turn
340 is 1716 (`108 + 2 × 116`). Three independent words agreeing with the game's own arithmetic
across a 336-turn span is a strong check on the whole header decode. `src/format/calendar.ts`
implements it; an editor that changes the date should write all three.

## Widths settled by the swap pass

| record             | words and longs, per the swap helper                                               | consequence                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Unit` (28B)       | words at `+0x18`, `+0x1a` only                                                     | everything else is bytes                                                                                  |
| `Colony` (202B)    | words `+0x90`, `+0x92`, `+0x98`, `+0x9a[16]`; longs `+0xc2`, `+0xc6`               | **stock is sixteen words**, matching `GOODS_COUNT` — not the 20/22/24 that different declarations claimed |
| `Nation` (316B)    | 11 words, 3 longs in the head, then `+0x5c[16]` words and three `[16]` long arrays | `+0x14` and `+0x48` are **bytes**, resolving two disagreements                                            |
| `Tribe` (78B)      | words `+0xa`, `+0xc`, `+0xe[16]`, `+0x2e[4]`, `+0x46[4]`                           |                                                                                                           |
| `Settlement` (18B) | four words at `+0xa`                                                               | the rest is ten bytes                                                                                     |

## Records

Sizes and identities come from win-decomp `docs/findings/record-types.md`, which identifies each
array by its allocator — the function that increments the count. Two of the three own the game's
own refusal messages:

| array              | size | count at       | cap | identified by                           |
| ------------------ | ---- | -------------- | --- | --------------------------------------- |
| units              | 28   | `SEG20:0x779e` | 300 | allocator owns `TOOMANYUNITS`           |
| colonies           | 202  | `SEG20:0x77a0` | 48  | allocator owns `TOOMANYCOLONIES`        |
| native settlements | 18   | `SEG20:0x779c` | 84  | every named indexer is a tribe function |

Note the size order: the **largest** record is the colony, which has the most state (buildings,
sixteen goods, thirty-two colonists' professions). An earlier reading guessed by size order and
got it wrong.

## The map

Four planes of `width × height` bytes. What is established:

- **Plane 0 — terrain.** Low five bits are an id in the game's 29-entry `TERRAIN0..TERRAIN28`
  table; bit 5 means hills-or-mountains with bit 7 choosing; bit 6 is a river, bit 7 making it
  major.
- **Plane 1 — a bitfield.** `0x0a` is Road and `0x40` is Plowed, taken from the colony window's
  own square description.
- **Plane 2 — the high nibble is a nation index**, with 15 meaning none. Five independent routes
  agree.
- **Plane 3 — unidentified.**

## The bug at `0x606f`

Write 54 is four bytes from a stack local the saver never assigns. It is passed through an
identity function, written, passed through again, and that is its whole life. So **every save
carries four bytes of whatever was on the stack, and two saves of the same game never compare
equal.** The loader reads them into a local of its own and discards them, so it does no harm.

This library carries them verbatim in `state.uninitialisedStack`. Never diff two saves on that
field.

## What is still unknown

- What most of `Colony+0x84..0x8f`, `Unit+0x04..0x0b` and the `Nation` head words mean.
- How the unit cargo region at `+0x0d..+0x16` splits — one reconstruction says `cargo[3]` then
  `amount[7]`, another a single `cargo[10]`. Kept as one 10-byte run.
- The 208-byte block at `0x9e`. The swap pass says four 52-byte records with a word at `+0x32`;
  a reconstruction places a 52-byte array with a CONTROL byte at `SEG20:0x7840`, which is 48
  bytes into the block and so not a multiple of 52. The two readings cannot both be right.
- How far the founding-father bitset at `Nation+0x14` runs (25 fathers need four bytes).
- Plane 3 entirely.
- **Whether the layout is version-stable.** Two saves is two samples, both version `0x49`.

## Sources

| claim                                                    | where                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| the 57 fields, offsets and sizes                         | win-decomp `docs/formats/save-file.md`                              |
| the loader agreeing field for field                      | win-decomp `docs/re_agent/save-layout-crosscheck.md`                |
| what the three counted arrays hold                       | win-decomp `docs/findings/record-types.md`                          |
| record field names and offsets                           | win-decomp `docs/findings/struct-layouts.md`                        |
| the map planes                                           | win-decomp `docs/findings/map-planes.md`, `terrain-table.md`        |
| the nation index space                                   | win-decomp `docs/findings/nation-index.md`                          |
| value tables (goods, jobs, fathers, terrain, difficulty) | win-decomp `include/*.h`, re-derived from the game's TEXT resources |
