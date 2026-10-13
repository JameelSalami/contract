import { verifiedProjectionDigest } from "./projection-integrity.js";
import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import type { GuidanceSourceProjection } from "./guidance-source.js";
import { compareText, NonEmpty, decodeStrict, sortedUnique } from "./internal.js";

const InputSchema = Schema.Struct({
  id: NonEmpty,
  sources: Schema.Array(Schema.Unknown),
  targetRefs: Schema.Array(NonEmpty),
  mode: Schema.Literal("required", "on-demand"),
  delivery: Schema.Literal("inline", "indexed", "external"),
  authority: Schema.Literal("none"),
});

export interface GuidanceBinding {
  readonly schema: "contract.guidance-binding/v1";
  readonly id: string;
  readonly sources: readonly {
    readonly ref: string;
    readonly format: string;
    readonly path: string;
    readonly digest: string;
    readonly projectionDigest: string;
  }[];
  readonly targetRefs: readonly string[];
  readonly mode: "required" | "on-demand";
  readonly delivery: "inline" | "indexed" | "external";
  readonly authority: "none";
  readonly digest: string;
}

export type GuidanceBindingResult =
  | { readonly _tag: "GuidanceBinding"; readonly binding: GuidanceBinding }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-guidance-binding"
        | "invalid-guidance-source-projection"
        | "duplicate-guidance-source"
        | "binding-not-canonicalizable";
    };

function validProjection(value: unknown): value is GuidanceSourceProjection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const projection = value as Partial<GuidanceSourceProjection>;
  return (
    verifiedProjectionDigest(projection) &&
    projection.schema === "contract.guidance-source-projection/v1" &&
    typeof projection.source === "object" &&
    projection.source !== null &&
    typeof projection.source.ref === "string" &&
    projection.source.ref === "guidance:" + projection.source.path &&
    typeof projection.source.format === "string" &&
    projection.source.format.length > 0 &&
    typeof projection.source.path === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.source.digest ?? "")) &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.projectionDigest ?? ""))
  );
}

export function compileGuidanceBinding(input: unknown): GuidanceBindingResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null || decoded.sources.length === 0 || decoded.targetRefs.length === 0) {
    return { _tag: "Refusal", reason: "invalid-guidance-binding" };
  }
  if (!decoded.sources.every(validProjection)) {
    return { _tag: "Refusal", reason: "invalid-guidance-source-projection" };
  }

  const refs = decoded.sources.map((source) => source.source.ref);
  if (new Set(refs).size !== refs.length) {
    return { _tag: "Refusal", reason: "duplicate-guidance-source" };
  }

  const sources = Object.freeze(
    decoded.sources
      .map((source) => Object.freeze({
        ref: source.source.ref,
        format: source.source.format,
        path: source.source.path,
        digest: source.source.digest,
        projectionDigest: source.projectionDigest,
      }))
      .sort((a, b) => compareText(a.ref, b.ref)),
  );
  const body = {
    schema: "contract.guidance-binding/v1" as const,
    id: decoded.id,
    sources,
    targetRefs: Object.freeze(sortedUnique(decoded.targetRefs)),
    mode: decoded.mode,
    delivery: decoded.delivery,
    authority: "none" as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "binding-not-canonicalizable" };
  }

  return {
    _tag: "GuidanceBinding",
    binding: Object.freeze({ ...body, digest: digest.digest }),
  };
}
