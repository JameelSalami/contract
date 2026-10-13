import { verifiedProjectionDigest } from "./projection-integrity.js";
import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import type { DesignSourceProjection } from "./design-source.js";
import { Digest, NonEmpty, decodeStrict } from "./internal.js";

const BindingInputSchema = Schema.Struct({
  id: NonEmpty,
  source: Schema.Unknown,
  humanProjectionContractRef: NonEmpty,
  uiCompositionContractRef: NonEmpty,
  acceptanceContractRef: NonEmpty,
  authority: Schema.Literal("none"),
});

export interface DesignSourceBinding {
  readonly schema: "contract.design-source-binding/v1";
  readonly id: string;
  readonly sourceRef: string;
  readonly sourceDigest: string;
  readonly sourceProjectionDigest: string;
  readonly humanProjectionContractRef: string;
  readonly uiCompositionContractRef: string;
  readonly acceptanceContractRef: string;
  readonly authority: "none";
  readonly digest: string;
}

export type DesignSourceBindingResult =
  | { readonly _tag: "DesignSourceBinding"; readonly binding: DesignSourceBinding }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-design-source-binding"
        | "invalid-design-source-projection"
        | "binding-not-canonicalizable";
    };

function validProjection(value: unknown): value is DesignSourceProjection {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) return false;
  const projection = value as Partial<DesignSourceProjection>;
  return (
    verifiedProjectionDigest(projection) &&
    projection.schema === "contract.design-source-projection/v1" &&
    typeof projection.source === "object" &&
    projection.source !== null &&
    projection.source.kind === "design-md" &&
    typeof projection.source.ref === "string" &&
    projection.source.ref === "design:" + projection.source.path &&
    typeof projection.source.path === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.source.digest ?? "")) &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.projectionDigest ?? ""))
  );
}

export function compileDesignSourceBinding(
  input: unknown,
): DesignSourceBindingResult {
  const decoded = decodeStrict(BindingInputSchema, input);
  if (decoded === null) {
    return { _tag: "Refusal", reason: "invalid-design-source-binding" };
  }
  if (!validProjection(decoded.source)) {
    return { _tag: "Refusal", reason: "invalid-design-source-projection" };
  }

  const body = {
    schema: "contract.design-source-binding/v1" as const,
    id: decoded.id,
    sourceRef: decoded.source.source.ref,
    sourceDigest: decoded.source.source.digest,
    sourceProjectionDigest: decoded.source.projectionDigest,
    humanProjectionContractRef: decoded.humanProjectionContractRef,
    uiCompositionContractRef: decoded.uiCompositionContractRef,
    acceptanceContractRef: decoded.acceptanceContractRef,
    authority: "none" as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "binding-not-canonicalizable" };
  }

  return {
    _tag: "DesignSourceBinding",
    binding: Object.freeze({
      ...body,
      digest: digest.digest,
    }),
  };
}
