import { sha256Text } from "./internal.js";

type CanonicalValue =
  | null
  | boolean
  | string
  | number
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export type CanonicalRefusalReason =
  | "non-json-value"
  | "unsafe-number"
  | "cyclic-value";

export type CanonicalDigestResult =
  | { readonly _tag: "Digest"; readonly digest: string }
  | {
      readonly _tag: "Refusal";
      readonly reason: CanonicalRefusalReason;
    };

type Normalized =
  | { readonly ok: true; readonly value: CanonicalValue }
  | { readonly ok: false; readonly reason: CanonicalRefusalReason };

function normalize(value: unknown, ancestors: WeakSet<object>): Normalized {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return { ok: true, value };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { ok: false, reason: "unsafe-number" };
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      return { ok: false, reason: "unsafe-number" };
    }
    return { ok: true, value: Object.is(value, -0) ? 0 : value };
  }

  if (typeof value !== "object") {
    return { ok: false, reason: "non-json-value" };
  }

  const objectValue = value as object;
  if (ancestors.has(objectValue)) {
    return { ok: false, reason: "cyclic-value" };
  }

  if (Array.isArray(value)) {
    ancestors.add(objectValue);
    const out: CanonicalValue[] = [];
    for (const item of value) {
      const normalized = normalize(item, ancestors);
      if (!normalized.ok) {
        ancestors.delete(objectValue);
        return normalized;
      }
      out.push(normalized.value);
    }
    ancestors.delete(objectValue);
    return { ok: true, value: out };
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return { ok: false, reason: "non-json-value" };
  }

  ancestors.add(objectValue);
  const out: Record<string, CanonicalValue> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort((a, b) => a.localeCompare(b))) {
    const normalized = normalize(
      (value as Record<string, unknown>)[key],
      ancestors,
    );
    if (!normalized.ok) {
      ancestors.delete(objectValue);
      return normalized;
    }
    out[key] = normalized.value;
  }
  ancestors.delete(objectValue);
  return { ok: true, value: out };
}

export function canonicalDigest(value: unknown): CanonicalDigestResult {
  const normalized = normalize(value, new WeakSet<object>());
  if (!normalized.ok) {
    return { _tag: "Refusal", reason: normalized.reason };
  }
  return {
    _tag: "Digest",
    digest: sha256Text(JSON.stringify(normalized.value)),
  };
}
