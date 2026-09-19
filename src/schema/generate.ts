/**
 * Generate `schema/savegame.schema.json` from the SAME field tables the codec runs on.
 *
 * The schema is a build artefact, not a second description. Hand-editing it would let it
 * drift from the codec, which is exactly the bug a schema is supposed to catch, so
 * `npm run schema -- --check` fails if the committed file is stale -- wire that into CI.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTIONS, SAVE_VERSION } from '../format/layout.js';
import { fieldSize, type FieldSpec, type RecordSpec } from '../format/types.js';
import { GLOBALS } from '../format/records.js';
import { DOC_FORMAT_VERSION } from '../codec/savegame.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = join(HERE, '..', '..', 'schema', 'savegame.schema.json');
const SCHEMA_ID = 'https://colonization-re.github.io/schema/savegame.schema.json';

type JsonSchema = Record<string, unknown>;

const B64 = {
  type: 'object',
  description: 'Raw bytes, carried verbatim so the round-trip stays byte-exact.',
  properties: { $b64: { type: 'string', contentEncoding: 'base64' } },
  required: ['$b64'],
  additionalProperties: false,
} as const;

/** Value ranges by width. Deliberately NOT tightened by enum: see src/format/enums.ts. */
const RANGE: Record<string, JsonSchema> = {
  u8: { type: 'integer', minimum: 0, maximum: 255 },
  i8: { type: 'integer', minimum: -128, maximum: 127 },
  u16: { type: 'integer', minimum: 0, maximum: 65535 },
  i16: { type: 'integer', minimum: -32768, maximum: 32767 },
  u32: { type: 'integer', minimum: 0, maximum: 4294967295 },
  i32: { type: 'integer', minimum: -2147483648, maximum: 2147483647 },
};

function fieldSchema(f: FieldSpec): JsonSchema {
  const note = [
    `+0x${f.offset.toString(16).padStart(2, '0')}`,
    `${fieldSize(f)}B`,
    `confidence: ${f.confidence}`,
    f.enum ? `values: ${f.enum}` : '',
    f.desc ?? '',
  ].filter(Boolean).join(' | ');

  if (f.type === 'char') return { type: 'string', maxLength: fieldSize(f), description: note };
  if (f.type === 'bytes') return { ...B64, description: note };
  const base = RANGE[f.type]!;
  if (f.count !== undefined) {
    return { type: 'array', items: base, minItems: f.count, maxItems: f.count, description: note };
  }
  return { ...base, description: note };
}

function recordSchema(spec: RecordSpec): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const f of spec.fields) {
    properties[f.name] = fieldSchema(f);
    required.push(f.name);
    if (f.type === 'char') properties[f.name + '$tail'] = { ...B64, description: 'Non-zero bytes after the string terminator, if any.' };
  }
  return {
    type: 'object',
    title: spec.name,
    description: `${spec.desc ?? ''} ${spec.size} bytes.`.trim(),
    properties,
    required,
    additionalProperties: false,
  };
}

export function buildSchema(): JsonSchema {
  const defs: Record<string, JsonSchema> = {};
  const properties: Record<string, JsonSchema> = {
    formatVersion: { const: DOC_FORMAT_VERSION, description: 'Version of THIS JSON model, not of the save file.' },
    header: {
      type: 'object',
      properties: {
        magic: { const: 'COLONIZE' },
        eofMarker: { ...RANGE.u8, description: 'DOS end-of-file byte, 0x1a. Part of the magic as far as the loader is concerned.' },
        version: { ...RANGE.u16, description: `Save version. The game accepts only 0x${SAVE_VERSION.toString(16)}.` },
        mapWidth: { ...RANGE.u16, description: 'Map columns. 58 in both known saves. Sets each map plane to width*height bytes.' },
        mapHeight: { ...RANGE.u16, description: 'Map rows. 72 in both known saves.' },
      },
      required: ['magic', 'eofMarker', 'version', 'mapWidth', 'mapHeight'],
      additionalProperties: false,
    },
    map: {
      type: 'object',
      description: 'Four planes of width*height bytes. Plane 0 is terrain (low 5 bits = id, bit 5 hilly, bit 6 river); plane 2 carries a nation index in its high nibble; plane 1 is a bitfield holding roads and plowing. Plane 3 is unidentified.',
      properties: {
        width: RANGE.u16!,
        height: RANGE.u16!,
        planes: {
          type: 'array', minItems: 4, maxItems: 4,
          items: { type: 'string', contentEncoding: 'base64' },
        },
      },
      required: ['width', 'height', 'planes'],
      additionalProperties: false,
    },
  };
  const required = ['formatVersion', 'header', 'map', 'state'];

  defs.Globals = recordSchema(GLOBALS);
  properties.globals = { $ref: '#/$defs/Globals' };
  required.push('globals');

  const stateProps: Record<string, JsonSchema> = {};
  const stateRequired: string[] = [];

  for (const s of SECTIONS) {
    if (s.kind === 'array') {
      defs[s.spec.name] = recordSchema(s.spec);
      const count = s.count.kind === 'fixed'
        ? { minItems: s.count.n, maxItems: s.count.n }
        : { description: `Length must equal globals.${s.count.field}.` };
      properties[s.key] = { type: 'array', items: { $ref: `#/$defs/${s.spec.name}` }, ...count };
      required.push(s.key);
    } else if (s.kind === 'scalar') {
      stateProps[s.key] = { ...RANGE[s.type]!, description: `write ${s.writes} | ${s.desc ?? ''}`.trim() };
      stateRequired.push(s.key);
    } else if (s.kind === 'blob') {
      stateProps[s.key] = { ...B64, description: `write ${s.writes} | ${s.size} bytes | ${s.desc ?? ''}`.trim() };
      stateRequired.push(s.key);
    }
  }

  properties.state = {
    type: 'object',
    description: 'The top-level fields that are not records or map planes, in file order.',
    properties: stateProps,
    required: stateRequired,
    additionalProperties: false,
  };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: SCHEMA_ID,
    title: 'Colonization for Windows savegame',
    description:
      'The decoded form of a COLONIZE .SAV file. Derived from the 57 write calls in ' +
      'save_game_to_file_1008_a7f6 and cross-checked against load_saved_game_1008_9056. ' +
      'GENERATED by src/schema/generate.ts -- do not edit by hand.',
    type: 'object',
    properties,
    required,
    additionalProperties: false,
    $defs: defs,
  };
}

function main(): void {
  const text = JSON.stringify(buildSchema(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    const current = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf8') : '';
    if (current !== text) {
      console.error('schema/savegame.schema.json is stale. Run: npm run schema');
      process.exit(1);
    }
    console.log('schema is up to date');
    return;
  }
  writeFileSync(SCHEMA_PATH, text);
  console.log(`wrote ${SCHEMA_PATH}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
