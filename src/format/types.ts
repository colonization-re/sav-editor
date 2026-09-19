/**
 * The vocabulary the save format is described in.
 *
 * One rule governs everything here: a record's field table must claim EVERY byte of the
 * record exactly once. That is what makes a round-trip byte-exact even where we have no
 * idea what a field means -- unknown bytes are still named, still typed, still carried.
 */

/** Scalar widths. The file is little-endian throughout; see docs/save-format.md. */
export type Prim = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32';

/**
 * How much we actually know about a field.
 *
 *  - `high`    a byte-verified reconstruction names it, or an enum header pins it.
 *  - `medium`  named by few witnesses, or by inference; the name is a working label.
 *  - `unknown` we know the offset and the width and nothing else. Named `fNN` after its
 *              own offset so the name cannot be mistaken for a claim.
 */
export type Confidence = 'high' | 'medium' | 'unknown';

export interface FieldSpec {
  /** Key in the JSON document. */
  readonly name: string;
  /** Byte offset within the record. */
  readonly offset: number;
  /**
   * `char` is a fixed-length, NUL-padded string; `bytes` is a plain byte array.
   * Anything else is a scalar, repeated `count` times when `count > 1`.
   */
  readonly type: Prim | 'char' | 'bytes';
  /** Array length. Absent means a single value (and, for `char`/`bytes`, is invalid). */
  readonly count?: number;
  readonly confidence: Confidence;
  /** Name of an enum table in `./enums.ts`, for editor hints. Never enforced. */
  readonly enum?: string;
  readonly desc?: string;
}

export interface RecordSpec {
  readonly name: string;
  /** Total bytes. The field table is asserted to cover exactly this many. */
  readonly size: number;
  readonly fields: readonly FieldSpec[];
  readonly desc?: string;
}

export const PRIM_SIZE: Record<Prim, number> = {
  u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4,
};

/** Bytes a single field occupies. */
export function fieldSize(f: FieldSpec): number {
  const n = f.count ?? 1;
  if (f.type === 'char' || f.type === 'bytes') return n;
  return PRIM_SIZE[f.type] * n;
}

export function isScalar(f: FieldSpec): f is FieldSpec & { type: Prim } {
  return f.type !== 'char' && f.type !== 'bytes';
}

/**
 * Fill every gap in a field table with an `unknown` byte run, then assert total coverage.
 *
 * Writing a record spec therefore means listing only what is KNOWN; the gaps name
 * themselves. Throws on overlap or overrun, which is the invariant that keeps the codec
 * honest -- it runs at module load, so a bad table fails immediately rather than
 * silently corrupting a save.
 */
export function completeRecord(spec: RecordSpec): RecordSpec {
  const fields = [...spec.fields].sort((a, b) => a.offset - b.offset);
  const out: FieldSpec[] = [];
  let cursor = 0;

  const gap = (from: number, to: number) => {
    if (to > from) {
      out.push({
        name: `f${from.toString(16).padStart(2, '0')}`,
        offset: from,
        type: 'bytes',
        count: to - from,
        confidence: 'unknown',
      });
    }
  };

  for (const f of fields) {
    if (f.offset < cursor) {
      throw new Error(
        `${spec.name}.${f.name} at +0x${f.offset.toString(16)} overlaps the field before it ` +
          `(which ends at +0x${cursor.toString(16)})`,
      );
    }
    gap(cursor, f.offset);
    out.push(f);
    cursor = f.offset + fieldSize(f);
  }

  if (cursor > spec.size) {
    throw new Error(
      `${spec.name} field table runs to 0x${cursor.toString(16)} but the record is ` +
        `0x${spec.size.toString(16)} bytes`,
    );
  }
  gap(cursor, spec.size);

  return { ...spec, fields: out };
}
