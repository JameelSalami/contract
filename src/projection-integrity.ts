import { canonicalDigest } from "./canonical.js";

/** Checks self-consistency only, not publisher identity or authenticity. */
export function verifiedProjectionDigest(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const { projectionDigest, ...body } = record;
  if (
    typeof projectionDigest !== "string" ||
    !/^sha256:[0-9a-f]{64}$/.test(projectionDigest)
  ) return false;
  const calculated = canonicalDigest(body);
  return calculated._tag === "Digest" && calculated.digest === projectionDigest;
}
