/**
 * Schema validation, over the same generated schema the docs publish.
 *
 * Note what this does and does not prove. Passing means the document has the right shape
 * -- every field present, every width in range. It does NOT mean the save is playable:
 * the schema cannot express "colonies.length equals globals.colonyCount", and a save with
 * a colony on an ocean tile is perfectly well-formed. `serialize` enforces the count
 * agreement; playability is the game's business.
 */
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { buildSchema } from './schema/generate.js';
import type { SaveDocument } from './codec/savegame.js';

let cached: ValidateFunction | undefined;

function validator(): ValidateFunction {
  if (!cached) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    cached = ajv.compile(buildSchema());
  }
  return cached;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateDocument(doc: unknown): ValidationResult {
  const v = validator();
  const valid = v(doc) as boolean;
  return { valid, errors: valid ? [] : (v.errors ?? []).map(format) };
}

/** Throws on the first problem; convenient in a pipeline. */
export function assertValid(doc: unknown): asserts doc is SaveDocument {
  const { valid, errors } = validateDocument(doc);
  if (!valid) throw new Error(`document does not match the schema:\n  ${errors.join('\n  ')}`);
}

function format(e: ErrorObject): string {
  const where = e.instancePath || '(root)';
  return `${where} ${e.message ?? 'is invalid'}`;
}
