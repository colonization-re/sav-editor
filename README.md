# Colonization savegame editor

Read, edit and write _Colonization_ `.SAV` files. TypeScript, no runtime dependencies
beyond a JSON Schema validator.

Status: **the codec works.** Both known sample saves parse, validate against the schema, and
re-serialize byte-identically. The browser editor is next.

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
