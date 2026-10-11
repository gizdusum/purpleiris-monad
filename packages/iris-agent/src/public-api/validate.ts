import type { ObjectSchema, PropertySchema } from "./catalog";

/**
 * Input validation for the public API.
 *
 * The agent's tool inputs are produced by a model we control. Public callers are
 * not, so every argument is checked against the tool's schema and bounded before
 * it reaches a database query.
 */

export const LIMITS = {
  maxStringLength: 200,
  maxArrayLength: 50,
  maxAbsNumber: 1e15,
  maxDepth: 4,
} as const;

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; errors: string[] };

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function checkValue(
  schema: PropertySchema | ObjectSchema,
  value: unknown,
  path: string,
  depth: number,
  errors: string[]
): unknown {
  if (depth > LIMITS.maxDepth) {
    errors.push(`${path}: nested too deeply`);
    return undefined;
  }

  switch (schema.type) {
    case "string": {
      if (typeof value !== "string") {
        errors.push(`${path}: expected string, got ${typeName(value)}`);
        return undefined;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        errors.push(`${path}: must not be empty`);
        return undefined;
      }
      if (trimmed.length > LIMITS.maxStringLength) {
        errors.push(`${path}: longer than ${LIMITS.maxStringLength} characters`);
        return undefined;
      }
      if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
        errors.push(`${path}: contains control characters`);
        return undefined;
      }
      return trimmed;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(`${path}: expected a finite number, got ${typeName(value)}`);
        return undefined;
      }
      if (Math.abs(value) > LIMITS.maxAbsNumber) {
        errors.push(`${path}: out of range`);
        return undefined;
      }
      return value;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        errors.push(`${path}: expected boolean, got ${typeName(value)}`);
        return undefined;
      }
      return value;
    }
    case "array": {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeName(value)}`);
        return undefined;
      }
      if (value.length > LIMITS.maxArrayLength) {
        errors.push(`${path}: more than ${LIMITS.maxArrayLength} items`);
        return undefined;
      }
      const itemSchema = schema.items;
      if (!itemSchema) return value;
      return value.map((item, i) =>
        checkValue(itemSchema, item, `${path}[${i}]`, depth + 1, errors)
      );
    }
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${typeName(value)}`);
        return undefined;
      }
      const props = schema.properties ?? {};
      const required = schema.required ?? [];
      const input = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};

      for (const key of Object.keys(input)) {
        if (!Object.prototype.hasOwnProperty.call(props, key)) {
          const known = Object.keys(props);
          errors.push(
            `${path === "$" ? "" : `${path}.`}${key}: unknown argument` +
              (known.length
                ? ` (expected one of: ${known.join(", ")})`
                : " (this tool takes no arguments)")
          );
        }
      }
      for (const key of required) {
        if (input[key] === undefined || input[key] === null) {
          errors.push(`${path === "$" ? "" : `${path}.`}${key}: required`);
        }
      }
      for (const [key, propSchema] of Object.entries(props)) {
        const v = input[key];
        if (v === undefined || v === null) continue;
        const checked = checkValue(
          propSchema,
          v,
          path === "$" ? key : `${path}.${key}`,
          depth + 1,
          errors
        );
        if (checked !== undefined) out[key] = checked;
      }
      return out;
    }
    default:
      errors.push(`${path}: unsupported schema type`);
      return undefined;
  }
}

export function validateToolInput(schema: ObjectSchema, input: unknown): ValidationResult {
  const errors: string[] = [];
  const value = checkValue(schema, input ?? {}, "$", 0, errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: (value ?? {}) as Record<string, unknown> };
}

/**
 * Turn URL query parameters into typed tool arguments, so simple tools can be
 * called with a plain GET. Arrays and objects are accepted as JSON strings.
 */
export function coerceQueryParams(
  schema: ObjectSchema,
  params: Iterable<[string, string]>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of params) {
    const prop = schema.properties[key];
    if (!prop) {
      out[key] = raw; // left as-is so validation reports it as unknown
      continue;
    }
    switch (prop.type) {
      case "number": {
        const n = raw.trim() === "" ? NaN : Number(raw);
        out[key] = Number.isNaN(n) ? raw : n;
        break;
      }
      case "boolean":
        out[key] =
          raw === "true" || raw === "1" ? true : raw === "false" || raw === "0" ? false : raw;
        break;
      case "array":
      case "object":
        try {
          out[key] = JSON.parse(raw);
        } catch {
          out[key] = raw;
        }
        break;
      default:
        out[key] = raw;
    }
  }
  return out;
}
