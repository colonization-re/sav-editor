# CLAUDE.md

Parser, serializer and (eventually) browser editor for _Colonization for Windows_ `.SAV` files.

## What this repo is downstream of

Everything about the format comes from the [win-decomp](https://github.com/colonization-re/win-decomp) reconstruction. That repo is the source of truth; this one is a
consumer. When the two disagree, win-decomp wins and the fix belongs here.

Read [docs/save-format.md](docs/save-format.md) before touching `src/format/`. It says what is
established, what is contested and what is unknown, and it cites the win-decomp document behind
each claim.

## The invariant everything rests on

**`serialize(parse(bytes))` must be byte-identical, for every save.**

The save file has no checksum. Nothing downstream will catch a codec that quietly drops or
reorders a field — the game will just load a subtly wrong world. `test/roundtrip.test.ts` is the
only thing standing in that gap. It runs against two deliberately unalike saves (`AUTO01.SAV`,
turn 4, one colony; `_DECLARE.SAV`, turn 340, 29 colonies, 277 units) so the runtime-sized fields
are actually exercised.

Never weaken that test to make a change pass.

## How the format is described

`src/format/` is the single source of truth, and three things are generated from it: the codec,
the JSON Schema, and the documentation tables.

- `types.ts` — the vocabulary, plus `completeRecord`, which fills every gap in a field table with
  a named `fNN` byte run and then **asserts the table claims every byte of the record exactly
  once**. That assertion runs at module load, so a bad table fails immediately rather than
  corrupting a save.
- `records.ts` — the record layouts.
- `layout.ts` — the 57 top-level writes, in file order, each citing its write number.
- `enums.ts` — value tables transcribed from win-decomp `include/*.h`.
- `calendar.ts` — turn ↔ date, per `advance_turn_1008_29b4`.

**Write specs, not codec code.** Adding a field means adding a `FieldSpec`; the codec, the schema
and the round-trip guarantee follow. If you find yourself special-casing a record in
`src/codec/`, the spec vocabulary is probably missing something — extend that instead.

`schema/savegame.schema.json` is **generated**. Do not hand-edit it. `npm run schema -- --check`
fails when it is stale, and that check is part of `npm run check`.

## Naming and confidence

Every field carries a `confidence`, and it is not decoration — the editor surfaces it so users
know what they are changing.

- `high` — a byte-verified reconstruction names it, or an enum header pins it.
- `medium` — few witnesses, or inferred. A working label.
- `unknown` — offset and width only. **Name it `fNN` after its own offset**, so the name cannot be
  mistaken for a claim, and put what is suspected in `desc`.

Do not promote a field's confidence without a source. "It looks like gold" is a `desc` note, not a
name. When witnesses disagree, say so in `desc` rather than silently picking one — several fields
here document a contest that is still open.

## Commands

```bash
npm run check                      # typecheck + schema freshness + tests. Run before committing.
npm test
npm run sav -- info   saves/AUTO01.SAV
npm run sav -- verify saves/_DECLARE.SAV     # round-trip + schema, per file
npm run sav -- decode saves/AUTO01.SAV out.json
npm run sav -- encode out.json NEW.SAV
```

## Working with saves

- `saves/` holds the two known samples. **Both are version `0x49`, and two samples is two
  samples** — nothing here shows the layout is stable across versions. `parse` refuses an
  unknown version word by default; that is deliberate.
- New sample saves are very welcome: add the file, add a row to `SAMPLES` in the round-trip test.
  A save that fails to round-trip is a finding, not a bug to be worked around — it means the
  layout is wrong or version-dependent, and it should be reported upstream to win-decomp.
- Never diff two saves on `state.uninitialisedStack`. Those four bytes are a shipped bug — stack
  garbage the saver never initialises — so two saves of the same game legitimately differ there.

## Planned direction

A browser editor: load a `.SAV`, edit, download. No server, no upload of anyone's save anywhere.
Keep the core (`src/format`, `src/codec`) free of Node-only APIs so it runs unchanged in a
browser — `src/codec/cursor.ts` already falls back from `Buffer` to `btoa`/`atob` for that reason.
Node-only code belongs in `src/cli.ts` and `src/schema/generate.ts`.
