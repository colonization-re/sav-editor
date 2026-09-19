# Colonization savegame editor

Read, edit and write _Colonization_ `.SAV` files. TypeScript, no runtime dependencies
beyond a JSON Schema validator.

Status: **working.** Both known sample saves parse, validate against the schema, and
re-serialize byte-identically, and the browser editor runs on top of that.

## The editor

```bash
npm install
npm run web:dev          # http://localhost:5173/index.html
npm run web:build        # dist-web/index.html - ONE self-contained file, ~89 KB
```

The built page opens straight from `file://`. Drop a `.SAV` on it, edit, download. Nothing is
uploaded anywhere, because there is no server to upload it to.

Tabs: **Overview** (date, difficulty, who you play, game flags), **Nations** (gold, tax, bells,
crosses, Europe prices), **Colonies** (name, owner, all sixteen warehouse stocks), **Units**,
**Natives**, **Tribes**, **Map**, and **Raw fields**.

The map draws all four planes from the save: terrain with rivers, square ownership, the
per-nation explored map, and roads/plowing. Click a square to inspect and edit every plane's
bits; there is a one-click *Reveal whole map*.

Every panel's detail view ends in a generated field editor covering **every byte of the record**,
including the ones nobody has identified, each labelled with how much is actually known about it.

It is styled with [col.css](https://github.com/colonization-re/web-ui), the project's shared
design system, pinned to a release in `web/vendor/` and inlined at build time so the page
still asks the network for nothing. `npm run vendor:css -- v1.2.0` bumps it, checksum
verified. It follows the system theme and defaults to dark.
[docs/design-system-gaps.md](docs/design-system-gaps.md) lists the twelve things the editor
needed that the design system does not have yet, and what each is used for.

```bash
npm install
npm run check                            # typecheck, schema freshness, tests

npm run sav -- info   saves/AUTO01.SAV
npm run sav -- decode saves/AUTO01.SAV save.json
npm run sav -- encode save.json          NEW.SAV
```

```
$ npm run sav -- info saves/_DECLARE.SAV
saves/_DECLARE.SAV  35689 bytes
  version    0x49   map 58x72
  year       1716 (turn 340, season 0)
  difficulty Conquistador
  player     England
  colonies   29   units 277   settlements 48
    England      gold   11099  tax  19%  bells 1728  crosses 576
    France       gold      17  tax  72%  bells 722  crosses 2
    ...
```

## Command line

```bash
npm run sav -- info   saves/AUTO01.SAV
npm run sav -- verify saves/_DECLARE.SAV
```

## Library

```ts
import {
  parse,
  serialize,
  validateDocument,
} from "@colonization-re/savegame-editor";

const doc = parse(new Uint8Array(bytes));
doc.nations[0].gold = 999999; // England's treasury
doc.globals.difficulty = 0; // Discoverer
const out = serialize(doc); // ready to write back
```

The decoded document is plain JSON — every byte of the file is either a named field or a base64
blob, which is what makes the round-trip exact even for the parts nobody has identified yet.
`schema/savegame.schema.json` describes it and is generated from the same field tables the codec
runs on.

## What you can edit

Solidly identified: nation gold, tax rate, bells, crosses and Europe market prices; colony name,
position, population, per-colonist jobs and specialties, buildings and all sixteen warehouse
stocks; unit position, type, owner, orders and cargo; native settlement and tribe state; the map's
four planes; difficulty, year, turn and the game-state flags (including whether independence has
been declared).

Carried but not understood: roughly a third of the file. It round-trips untouched.

See [docs/save-format.md](docs/save-format.md) for what is established, what is contested, and
where each claim comes from.

## Caveats

- **Two sample saves, both version `0x49`.** Nothing here shows the layout is stable across
  versions or scenarios. `parse` refuses an unknown version word unless you pass
  `allowUnknownVersion`.
- **A valid document is not a playable save.** The schema checks shape, not sense. A colony in the
  ocean is well-formed.
- Back up your saves.

## Credit

The format was not reverse-engineered here. It comes from the
[win-decomp](https://github.com/colonization-re/win-decomp) reconstruction of the game binary — in
particular its recovery of the 57-call save routine and the matching loader. This repo is a
consumer of that work.

## Licence

MIT.
