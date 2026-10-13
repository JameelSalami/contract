import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Schema } from "effect";

export const NonEmpty = Schema.String.pipe(Schema.minLength(1));
export const Digest = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
);
export const IdentitySchema = Schema.Struct({
  id: NonEmpty,
  version: NonEmpty,
});
export const RefDigestSchema = Schema.Struct({
  ref: NonEmpty,
  digest: Digest,
});

export function decodeStrict<A, I>(
  schema: Schema.Schema<A, I, never>,
  input: unknown,
): A | null {
  try {
    return Schema.decodeUnknownSync(schema)(input, {
      onExcessProperty: "error",
    });
  } catch {
    return null;
  }
}

export function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function safeRelativePath(value: string): boolean {
  if (!value || value.startsWith("/") || value.includes("\\")) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

export function sha256Text(value: string): string {
  return "sha256:" + bytesToHex(sha256(utf8ToBytes(value)));
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}