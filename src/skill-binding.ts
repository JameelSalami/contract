import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import type { SkillSourceProjection } from "./skill-source.js";
import { NonEmpty, decodeStrict, sortedUnique } from "./internal.js";

const InputSchema = Schema.Struct({
  id: NonEmpty,
  source: Schema.Unknown,
  targetRefs: Schema.Array(NonEmpty),
  mode: Schema.Literal("required", "selected", "optional"),
  capabilityRefs: Schema.Array(NonEmpty),
  authority: Schema.Literal("none"),
});

export interface SkillBinding {
  readonly schema: "contract.skill-binding/v1";
  readonly id: string;
  readonly sourceRef: string;
  readonly sourceClosureDigest: string;
  readonly sourceProjectionDigest: string;
  readonly entrypoint: string;
  readonly targetRefs: readonly string[];
  readonly mode: "required" | "selected" | "optional";
  readonly capabilityRefs: readonly string[];
  readonly authority: "none";
  readonly digest: string;
}

export type SkillBindingResult =
  | { readonly _tag: "SkillBinding"; readonly binding: SkillBinding }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-skill-binding"
        | "invalid-skill-source-projection"
        | "binding-not-canonicalizable";
    };

function validProjection(value: unknown): value is SkillSourceProjection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const projection = value as Partial<SkillSourceProjection>;
  return (
    projection.schema === "contract.skill-source-projection/v1" &&
    typeof projection.source === "object" &&
    projection.source !== null &&
    typeof projection.source.ref === "string" &&
    projection.source.ref.length > 0 &&
    typeof projection.source.entrypoint === "string" &&
    projection.source.entrypoint.length > 0 &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.source.closureDigest ?? "")) &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.projectionDigest ?? "")) &&
    Array.isArray(projection.files) &&
    projection.files.some((file) => file.path === projection.source!.entrypoint)
  );
}

export function compileSkillBinding(input: unknown): SkillBindingResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null || decoded.targetRefs.length === 0) {
    return { _tag: "Refusal", reason: "invalid-skill-binding" };
  }
  if (!validProjection(decoded.source)) {
    return { _tag: "Refusal", reason: "invalid-skill-source-projection" };
  }
  const source = decoded.source;

  const body = {
    schema: "contract.skill-binding/v1" as const,
    id: decoded.id,
    sourceRef: source.source.ref,
    sourceClosureDigest: source.source.closureDigest,
    sourceProjectionDigest: source.projectionDigest,
    entrypoint: source.source.entrypoint,
    targetRefs: Object.freeze(sortedUnique(decoded.targetRefs)),
    mode: decoded.mode,
    capabilityRefs: Object.freeze(sortedUnique(decoded.capabilityRefs)),
    authority: "none" as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "binding-not-canonicalizable" };
  }

  return {
    _tag: "SkillBinding",
    binding: Object.freeze({ ...body, digest: digest.digest }),
  };
}
