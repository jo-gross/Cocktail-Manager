/**
 * Builds a minimal value that satisfies a zod (v4) schema: required object keys
 * only, shortest strings/arrays allowed, first enum/union option. Used by the
 * generic tenant-isolation suite to get past body validation; schemas with
 * regex/refinements need explicit overrides there.
 */
import type { z } from 'zod';

interface ZodDefLike {
  type: string;
  [key: string]: unknown;
}

function defOf(schema: unknown): ZodDefLike {
  return (schema as { _zod: { def: ZodDefLike } })._zod.def;
}

function checkValue(schema: unknown, kind: string): number | undefined {
  const checks = (defOf(schema).checks as Array<{ _zod: { def: { check: string; value?: number; minimum?: number; inclusive?: boolean } } }>) ?? [];
  for (const check of checks) {
    const def = check._zod.def;
    if (def.check === kind) return (def.minimum ?? def.value) as number;
  }
  return undefined;
}

function hasCheck(schema: unknown, kind: string): boolean {
  const checks = (defOf(schema).checks as Array<{ _zod: { def: { check: string; format?: string } } }>) ?? [];
  return checks.some((check) => check._zod.def.check === kind || check._zod.def.format === kind);
}

export function sampleFromSchema(schema: z.ZodTypeAny | unknown, depth = 0): unknown {
  if (depth > 12) return undefined;
  const def = defOf(schema);
  switch (def.type) {
    case 'object': {
      const shape = def.shape as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(shape)) {
        const type = defOf(value).type;
        if (type === 'optional' || type === 'default' || type === 'prefault') continue;
        const sample = sampleFromSchema(value, depth + 1);
        if (sample !== undefined) out[key] = sample;
      }
      return out;
    }
    case 'string': {
      const format = (def as { format?: string }).format;
      if (format === 'datetime' || hasCheck(schema, 'datetime')) return new Date('2026-01-01T12:00:00.000Z').toISOString();
      if (format === 'date') return '2026-01-01';
      if (format === 'email') return 'sample@example.com';
      if (format === 'url') return 'https://example.com';
      if (format === 'uuid') return '00000000-0000-4000-8000-000000000000';
      const min = checkValue(schema, 'min_length') ?? 1;
      return 'sample'.padEnd(Math.max(min, 6), 'x');
    }
    case 'number':
    case 'int': {
      const min = checkValue(schema, 'greater_than') ?? 1;
      return Math.max(1, Math.ceil(min));
    }
    case 'bigint':
      return BigInt(1);
    case 'boolean':
      return false;
    case 'date':
      return new Date('2026-01-01T12:00:00.000Z');
    case 'enum': {
      const entries = def.entries as Record<string, string | number>;
      return Object.values(entries)[0];
    }
    case 'literal':
      return (def.values as unknown[])[0];
    case 'array': {
      const min = checkValue(schema, 'min_length') ?? 0;
      return Array.from({ length: min }, () => sampleFromSchema(def.element, depth + 1));
    }
    case 'tuple':
      return (def.items as unknown[]).map((item) => sampleFromSchema(item, depth + 1));
    case 'record':
      return {};
    case 'union':
      return sampleFromSchema((def.options as unknown[])[0], depth + 1);
    case 'intersection':
      return {
        ...(sampleFromSchema(def.left, depth + 1) as object),
        ...(sampleFromSchema(def.right, depth + 1) as object),
      };
    case 'nullable':
      return sampleFromSchema(def.innerType, depth + 1);
    case 'optional':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'catch':
    case 'nonoptional':
      return sampleFromSchema(def.innerType, depth + 1);
    case 'pipe':
      return sampleFromSchema(def.in, depth + 1);
    case 'transform':
      return undefined;
    case 'lazy':
      return sampleFromSchema((def.getter as () => unknown)(), depth + 1);
    case 'null':
      return null;
    case 'any':
    case 'unknown':
      return {};
    default:
      return undefined;
  }
}
