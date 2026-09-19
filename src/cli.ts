#!/usr/bin/env node
/**
 * A small CLI, mostly so the codec can be exercised without a browser.
 *
 *   npm run sav -- info    saves/AUTO01.SAV
 *   npm run sav -- decode  saves/AUTO01.SAV  out.json
 *   npm run sav -- encode  out.json          NEW.SAV
 *   npm run sav -- verify  saves/AUTO01.SAV      # round-trip + schema
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, serialize } from './codec/savegame.js';
import { validateDocument } from './validate.js';
import { DIFFICULTY, NATION } from './format/enums.js';

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function read(p: string): Uint8Array { return new Uint8Array(readFileSync(p)); }

function info(path: string): void {
  const doc = parse(read(path));
  const g = doc.globals as Record<string, number>;
  const nations = doc.nations as Array<Record<string, number>>;
  console.log(`${path}  ${read(path).length} bytes`);
  console.log(`  version    0x${doc.header.version.toString(16)}   map ${doc.header.mapWidth}x${doc.header.mapHeight}`);
  console.log(`  year       ${g.year} (turn ${g.turnCounter}, season ${g.season})`);
  console.log(`  difficulty ${DIFFICULTY[g.difficulty!] ?? g.difficulty}`);
  console.log(`  player     ${NATION[g.playerNation!] ?? g.playerNation}`);
  console.log(`  colonies   ${doc.colonies.length}   units ${doc.units.length}   settlements ${doc.settlements.length}`);
  for (const [i, n] of nations.entries()) {
    console.log(`    ${String(NATION[i]).padEnd(12)} gold ${String(n.gold).padStart(7)}  tax ${String(n.tax).padStart(3)}%  bells ${n.bells}  crosses ${n.crosses}`);
  }
  for (const c of doc.colonies as Array<Record<string, unknown>>) {
    console.log(`    colony "${c.name}" (${c.x},${c.y}) pop ${c.pop} of ${NATION[c.nation as number]}`);
  }
}

function verify(path: string): void {
  const original = read(path);
  const doc = parse(original);
  const { valid, errors } = validateDocument(doc);
  const again = serialize(doc);
  const same = again.length === original.length && again.every((b, i) => b === original[i]);
  console.log(`${path}`);
  console.log(`  schema      ${valid ? 'valid' : 'INVALID'}`);
  if (!valid) for (const e of errors.slice(0, 10)) console.log(`    ${e}`);
  console.log(`  round-trip  ${same ? 'byte-identical' : 'DIFFERS'}`);
  if (!same) {
    const at = again.findIndex((b, i) => b !== original[i]);
    console.log(`    first difference at 0x${at.toString(16)} (${again.length} vs ${original.length} bytes)`);
    process.exitCode = 1;
  }
  if (!valid) process.exitCode = 1;
}

const [cmd, a, b] = process.argv.slice(2);
switch (cmd) {
  case 'info': info(a ?? die('usage: info <save>')); break;
  case 'verify': verify(a ?? die('usage: verify <save>')); break;
  case 'decode': {
    if (!a || !b) die('usage: decode <save> <out.json>');
    writeFileSync(b, JSON.stringify(parse(read(a)), null, 2) + '\n');
    console.log(`wrote ${b}`);
    break;
  }
  case 'encode': {
    if (!a || !b) die('usage: encode <in.json> <out.sav>');
    const doc = JSON.parse(readFileSync(a, 'utf8'));
    const { valid, errors } = validateDocument(doc);
    if (!valid) die(`refusing to write: document does not match the schema\n  ${errors.slice(0, 10).join('\n  ')}`);
    writeFileSync(b, serialize(doc));
    console.log(`wrote ${b}`);
    break;
  }
  default:
    die('usage: sav <info|verify|decode|encode> ...');
}
