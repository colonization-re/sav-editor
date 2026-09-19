/**
 * Whole-file parse and serialize.
 *
 * The document this produces is the editable model: every byte of the input is either a
 * decoded field or a base64 blob, so `serialize(parse(bytes))` is byte-identical. That is
 * asserted by the round-trip test against both sample saves.
 */
import { HEADER_SIZE, MAGIC, SAVE_VERSION, SECTIONS, type CountSource, type Section } from '../format/layout.js';
import { fromBase64, Reader, toBase64, Writer } from './cursor.js';
import { decodeRecord, encodeRecord, type RecordValue } from './record.js';

export const DOC_FORMAT_VERSION = 1;

export interface SaveHeader {
  /** Always `COLONIZE`. The loader STRCMPs it together with the DOS EOF byte below. */
  magic: string;
  /** 0x1a, a DOS end-of-file marker, so `TYPE SAVE.SAV` stops at the first line. */
  eofMarker: number;
  /** The loader rejects anything but 0x49; see SAVE_VERSION. */
  version: number;
  mapWidth: number;
  mapHeight: number;
}

export interface SaveMap {
  width: number;
  height: number;
  /** Four planes of `width * height` bytes, base64. Plane 0 is terrain, plane 2 holds a nation index per nibble. */
  planes: [string, string, string, string];
}

export interface SaveDocument {
  formatVersion: number;
  header: SaveHeader;
  globals: RecordValue;
  block52: RecordValue[];
  rec6: RecordValue[];
  colonies: RecordValue[];
  units: RecordValue[];
  nations: RecordValue[];
  settlements: RecordValue[];
  tribes: RecordValue[];
  map: SaveMap;
  /** Every remaining top-level write, by key. Numbers are scalars; `{$b64}` are carried blobs. */
  state: Record<string, number | { $b64: string }>;
}

export interface ParseOptions {
  /**
   * Accept a version word other than 0x49. The layout is known from ONE build; a
   * different version may lay its fields out differently, so this is opt-in and the
   * caller owns the risk.
   */
  allowUnknownVersion?: boolean;
}

export function parse(bytes: Uint8Array, opts: ParseOptions = {}): SaveDocument {
  const r = new Reader(bytes);

  const magicRaw = r.bytes_(10);
  const magic = new TextDecoder('latin1').decode(magicRaw);
  if (magic !== MAGIC) {
    throw new Error(
      `not a Colonization save: expected magic ${JSON.stringify(MAGIC)}, got ${JSON.stringify(magic)}`,
    );
  }
  const version = r.u16();
  if (version !== SAVE_VERSION && !opts.allowUnknownVersion) {
    throw new Error(
      `save version 0x${version.toString(16)} is not the 0x${SAVE_VERSION.toString(16)} this ` +
        `layout was derived from; the game itself refuses it too. Pass allowUnknownVersion to try anyway.`,
    );
  }
  const mapWidth = r.u16();
  const mapHeight = r.u16();

  const doc: SaveDocument = {
    formatVersion: DOC_FORMAT_VERSION,
    header: { magic: 'COLONIZE', eofMarker: magicRaw[9]!, version, mapWidth, mapHeight },
    globals: {},
    block52: [], rec6: [], colonies: [], units: [], nations: [], settlements: [], tribes: [],
    map: { width: mapWidth, height: mapHeight, planes: ['', '', '', ''] },
    state: {},
  };

  const planeBytes = mapWidth * mapHeight;

  for (const s of SECTIONS) {
    switch (s.kind) {
      case 'struct':
        doc.globals = decodeRecord(s.spec, r);
        break;
      case 'array': {
        const n = resolveCount(s.count, doc);
        const arr: RecordValue[] = [];
        for (let i = 0; i < n; i++) arr.push(decodeRecord(s.spec, r));
        (doc as unknown as Record<string, RecordValue[]>)[s.key] = arr;
        break;
      }
      case 'scalar':
        doc.state[s.key] = readScalarSection(s, r);
        break;
      case 'blob':
        doc.state[s.key] = { $b64: toBase64(r.bytes_(s.size)) };
        break;
      case 'plane':
        doc.map.planes[s.index] = toBase64(r.bytes_(planeBytes));
        break;
    }
  }

  if (r.remaining !== 0) {
    throw new Error(
      `${r.remaining} trailing byte(s) after the last field at 0x${r.offset.toString(16)} -- ` +
        `the layout does not account for this file`,
    );
  }
  return doc;
}

export function serialize(doc: SaveDocument): Uint8Array {
  const w = new Writer();

  w.bytes_(new TextEncoder().encode('COLONIZE\0'));
  w.u8(doc.header.eofMarker);
  w.u16(doc.header.version);
  w.u16(doc.header.mapWidth);
  w.u16(doc.header.mapHeight);
  if (w.length !== HEADER_SIZE) throw new Error('header did not come out 16 bytes');

  const planeBytes = doc.header.mapWidth * doc.header.mapHeight;

  for (const s of SECTIONS) {
    switch (s.kind) {
      case 'struct':
        encodeRecord(s.spec, doc.globals, w);
        break;
      case 'array': {
        const arr = (doc as unknown as Record<string, RecordValue[]>)[s.key] ?? [];
        const declared = resolveCount(s.count, doc);
        if (arr.length !== declared) {
          throw new Error(
            `${s.key} holds ${arr.length} record(s) but the count field says ${declared}. ` +
              `Adding or removing a record means updating globals.${countFieldName(s.count)} too.`,
          );
        }
        for (const v of arr) encodeRecord(s.spec, v, w);
        break;
      }
      case 'scalar':
        writeScalarSection(s, doc.state[s.key], w);
        break;
      case 'blob': {
        const v = doc.state[s.key];
        if (v === undefined || typeof v === 'number') throw new Error(`state.${s.key}: expected a {$b64} blob`);
        const b = fromBase64(v.$b64);
        if (b.length !== s.size) throw new Error(`state.${s.key}: expected ${s.size} bytes, got ${b.length}`);
        w.bytes_(b);
        break;
      }
      case 'plane': {
        const b = fromBase64(doc.map.planes[s.index]);
        if (b.length !== planeBytes) {
          throw new Error(`map.planes[${s.index}]: expected ${planeBytes} bytes (${doc.header.mapWidth}x${doc.header.mapHeight}), got ${b.length}`);
        }
        w.bytes_(b);
        break;
      }
    }
  }
  return w.finish();
}

function countFieldName(c: CountSource): string {
  return c.kind === 'global' ? c.field : String(c.n);
}

function resolveCount(c: CountSource, doc: SaveDocument): number {
  if (c.kind === 'fixed') return c.n;
  const v = doc.globals[c.field];
  if (typeof v !== 'number') throw new Error(`globals.${c.field} is missing or not a number`);
  return v;
}

function readScalarSection(s: Extract<Section, { kind: 'scalar' }>, r: Reader): number {
  switch (s.type) {
    case 'u8': return r.u8();
    case 'u16': return r.u16();
    case 'i16': return r.i16();
    case 'u32': return r.u32();
    case 'i32': return r.i32();
  }
}

function writeScalarSection(
  s: Extract<Section, { kind: 'scalar' }>,
  v: number | { $b64: string } | undefined,
  w: Writer,
): void {
  if (typeof v !== 'number') throw new Error(`state.${s.key}: expected a number`);
  switch (s.type) {
    case 'u8': return w.u8(v);
    case 'u16': return w.u16(v);
    case 'i16': return w.i16(v);
    case 'u32': return w.u32(v);
    case 'i32': return w.i32(v);
  }
}
