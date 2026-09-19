/**
 * Little-endian byte cursors.
 *
 * The file is little-endian throughout. The saver LOOKS like it byte-swaps -- every block
 * is wrapped in a swap/write/swap-back sandwich -- but `swap_word_identity` is a 21-byte
 * function whose whole body is `return a;`, and the 32-bit helper likewise. They are
 * vestiges of the shared big-endian Mac source. On the Windows build nothing is swapped.
 */

export class Reader {
  private pos = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get offset(): number { return this.pos; }
  get remaining(): number { return this.bytes.length - this.pos; }

  private need(n: number): number {
    if (this.pos + n > this.bytes.length) {
      throw new RangeError(
        `save is truncated: wanted ${n} byte(s) at 0x${this.pos.toString(16)}, ` +
          `only ${this.remaining} left`,
      );
    }
    const at = this.pos;
    this.pos += n;
    return at;
  }

  u8(): number { return this.view.getUint8(this.need(1)); }
  i8(): number { return this.view.getInt8(this.need(1)); }
  u16(): number { return this.view.getUint16(this.need(2), true); }
  i16(): number { return this.view.getInt16(this.need(2), true); }
  u32(): number { return this.view.getUint32(this.need(4), true); }
  i32(): number { return this.view.getInt32(this.need(4), true); }

  bytes_(n: number): Uint8Array {
    const at = this.need(n);
    return this.bytes.slice(at, at + n);
  }
}

export class Writer {
  private chunks: Uint8Array[] = [];
  private len = 0;

  get length(): number { return this.len; }

  private push(b: Uint8Array): void { this.chunks.push(b); this.len += b.length; }

  private scalar(n: number, write: (v: DataView) => void): void {
    const b = new Uint8Array(n);
    write(new DataView(b.buffer));
    this.push(b);
  }

  u8(v: number): void { this.scalar(1, (d) => d.setUint8(0, v & 0xff)); }
  i8(v: number): void { this.scalar(1, (d) => d.setInt8(0, clamp(v, -128, 127))); }
  u16(v: number): void { this.scalar(2, (d) => d.setUint16(0, v & 0xffff, true)); }
  i16(v: number): void { this.scalar(2, (d) => d.setInt16(0, clamp(v, -32768, 32767), true)); }
  u32(v: number): void { this.scalar(4, (d) => d.setUint32(0, v >>> 0, true)); }
  i32(v: number): void { this.scalar(4, (d) => d.setInt32(0, v | 0, true)); }

  bytes_(b: Uint8Array): void { this.push(b); }

  finish(): Uint8Array {
    const out = new Uint8Array(this.len);
    let at = 0;
    for (const c of this.chunks) { out.set(c, at); at += c.length; }
    return out;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function toBase64(b: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(b).toString('base64');
  let s = '';
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
