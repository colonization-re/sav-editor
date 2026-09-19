/**
 * Generic record codec, driven entirely by a `RecordSpec`.
 *
 * Because `completeRecord` guarantees the field table claims every byte exactly once,
 * `decodeRecord` followed by `encodeRecord` is the identity on any input -- including
 * bytes nobody has identified. That is the property the round-trip test pins.
 *
 * Strings are the one lossy-looking case and are not: a `char` field is stored as text up
 * to the first NUL, and re-encoded NUL-padded to the full width. Colonization writes its
 * names that way, and both sample saves round-trip. If a save ever carried garbage AFTER
 * the terminator, this would drop it -- so `decodeRecord` keeps such a tail rather than
 * discarding it (see `charTail`).
 */
import { fieldSize, isScalar, type FieldSpec, type RecordSpec } from '../format/types.js';
import { fromBase64, Reader, toBase64, Writer } from './cursor.js';

export type FieldValue = number | number[] | string | { $b64: string };
export type RecordValue = Record<string, FieldValue>;

/** Suffix for the bytes after a string's NUL terminator, when any are non-zero. */
export const CHAR_TAIL_SUFFIX = '$tail';

export function decodeRecord(spec: RecordSpec, r: Reader): RecordValue {
  const out: RecordValue = {};
  for (const f of spec.fields) {
    if (f.type === 'char') {
      const raw = r.bytes_(fieldSize(f));
      const nul = raw.indexOf(0);
      const end = nul === -1 ? raw.length : nul;
      out[f.name] = new TextDecoder('latin1').decode(raw.subarray(0, end));
      const tail = raw.subarray(end);
      if (tail.some((b) => b !== 0)) out[f.name + CHAR_TAIL_SUFFIX] = { $b64: toBase64(tail) };
    } else if (f.type === 'bytes') {
      out[f.name] = { $b64: toBase64(r.bytes_(fieldSize(f))) };
    } else if (f.count !== undefined) {
      const arr: number[] = [];
      for (let i = 0; i < f.count; i++) arr.push(readScalar(f, r));
      out[f.name] = arr;
    } else {
      out[f.name] = readScalar(f, r);
    }
  }
  return out;
}

export function encodeRecord(spec: RecordSpec, value: RecordValue, w: Writer): void {
  for (const f of spec.fields) {
    const v = value[f.name];
    if (v === undefined) throw new Error(`${spec.name}: missing field "${f.name}"`);

    if (f.type === 'char') {
      const width = fieldSize(f);
      const text = new TextEncoder().encode(String(v));
      if (text.length > width) {
        throw new Error(`${spec.name}.${f.name}: "${String(v)}" is ${text.length} bytes, max ${width}`);
      }
      const buf = new Uint8Array(width);
      buf.set(text.subarray(0, width));
      const tail = value[f.name + CHAR_TAIL_SUFFIX];
      if (tail !== undefined) {
        const tb = fromBase64((tail as { $b64: string }).$b64);
        buf.set(tb.subarray(0, width - text.length), text.length);
      }
      w.bytes_(buf);
    } else if (f.type === 'bytes') {
      const b = fromBase64((v as { $b64: string }).$b64);
      if (b.length !== fieldSize(f)) {
        throw new Error(`${spec.name}.${f.name}: expected ${fieldSize(f)} bytes, got ${b.length}`);
      }
      w.bytes_(b);
    } else if (f.count !== undefined) {
      const arr = v as number[];
      if (arr.length !== f.count) {
        throw new Error(`${spec.name}.${f.name}: expected ${f.count} values, got ${arr.length}`);
      }
      for (const n of arr) writeScalar(f, n, w);
    } else {
      writeScalar(f, v as number, w);
    }
  }
}

function readScalar(f: FieldSpec, r: Reader): number {
  if (!isScalar(f)) throw new Error(`${f.name} is not a scalar`);
  switch (f.type) {
    case 'u8': return r.u8();
    case 'i8': return r.i8();
    case 'u16': return r.u16();
    case 'i16': return r.i16();
    case 'u32': return r.u32();
    case 'i32': return r.i32();
  }
}

function writeScalar(f: FieldSpec, v: number, w: Writer): void {
  if (!isScalar(f)) throw new Error(`${f.name} is not a scalar`);
  switch (f.type) {
    case 'u8': return w.u8(v);
    case 'i8': return w.i8(v);
    case 'u16': return w.u16(v);
    case 'i16': return w.i16(v);
    case 'u32': return w.u32(v);
    case 'i32': return w.i32(v);
  }
}
