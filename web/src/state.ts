/**
 * Application state: the open document, and who to tell when it changes.
 *
 * The document is mutated in place and panels re-render from it. There is no undo yet --
 * `Revert` re-parses the original bytes, which is why they are kept.
 */
import { parse, serialize, type SaveDocument } from '../../src/codec/savegame.js';

export interface OpenSave {
  name: string;
  /** The bytes as loaded, kept so Revert and the "changed bytes" count stay honest. */
  original: Uint8Array;
  doc: SaveDocument;
}

type Listener = () => void;

class Store {
  save: OpenSave | undefined;
  dirty = false;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener): void { this.listeners.add(fn); }
  emit(): void { for (const fn of this.listeners) fn(); }

  open(name: string, bytes: Uint8Array): void {
    // parse() throws on a bad magic, an unexpected version, or trailing bytes; letting
    // that reach the caller is the point -- a file we cannot account for exactly is a
    // file we must not pretend to edit.
    this.save = { name, original: bytes, doc: parse(bytes) };
    this.dirty = false;
    this.emit();
  }

  revert(): void {
    if (!this.save) return;
    this.save.doc = parse(this.save.original);
    this.dirty = false;
    this.emit();
  }

  touch(): void { this.dirty = true; this.emit(); }

  /** Serialize, and report how many bytes moved -- a cheap sanity check for the user. */
  build(): { bytes: Uint8Array; changed: number } {
    if (!this.save) throw new Error('nothing open');
    const bytes = serialize(this.save.doc);
    const { original } = this.save;
    let changed = 0;
    if (bytes.length === original.length) {
      for (let i = 0; i < bytes.length; i++) if (bytes[i] !== original[i]) changed++;
    } else {
      changed = -1;
    }
    return { bytes, changed };
  }
}

export const store = new Store();

export function download(name: string, bytes: Uint8Array | string, type: string): void {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
