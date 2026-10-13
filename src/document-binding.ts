import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import type { DocumentSourceProjection } from "./document-source.js";
import { NonEmpty, decodeStrict, sortedUnique } from "./internal.js";

const InputSchema = Schema.Struct({
  id: NonEmpty,
  source: Schema.Unknown,
  bindingKind: NonEmpty,
  targetRefs: Schema.Array(NonEmpty),
  authority: Schema.Literal("none"),
});

export interface DocumentBinding {
  readonly schema: "contract.document-binding/v1";
  readonly id: string;
  readonly sourceRef: string;
  readonly sourceKind: string;
  readonly sourcePath: string;
  readonly sourceDigest: string;
  readonly sourceProjectionDigest: string;
  readonly bindingKind: string;
  readonly targetRefs: readonly string[];
  readonly authority: "none";
  readonly digest: string;
}

export type DocumentBindingResult =
  | { readonly _tag: "DocumentBinding"; readonly binding: DocumentBinding }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-document-binding"
        | "invalid-document-source-projection"
        | "binding-not-canonicalizable";
    };

function validProjection(value: unknown): value is DocumentSourceProjection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const projection = value as Partial<DocumentSourceProjection>;
  return (
    projection.schema === "contract.document-source-projection/v1" &&
    typeof projection.source === "object" &&
    projection.source !== null &&
    typeof projection.source.ref === "string" &&
    projection.source.ref.length > 0 &&
    typeof projection.source.kind === "string" &&
    projection.source.kind.length > 0 &&
    typeof projection.source.path === "string" &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.source.digest ?? "")) &&
    /^sha256:[0-9a-f]{64}$/.test(String(projection.projectionDigest ?? ""))
  );
}

export function compileDocumentBinding(input: unknown): DocumentBindingResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null || decoded.targetRefs.length === 0) {
    return { _tag: "Refusal", reason: "invalid-document-binding" };
  }
  if (!validProjection(decoded.source)) {
    return { _tag: "Refusal", reason: "invalid-document-source-projection" };
  }

  const body = {
    schema: "contract.document-binding/v1" as const,
    id: decoded.id,
    sourceRef: decoded.source.source.ref,
    sourceKind: decoded.source.source.kind,
    sourcePath: decoded.source.source.path,
    sourceDigest: decoded.source.source.digest,
    sourceProjectionDigest: decoded.source.projectionDigest,
    bindingKind: decoded.bindingKind,
    targetRefs: Object.freeze(sortedUnique(decoded.targetRefs)),
    authority: "none" as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "binding-not-canonicalizable" };
  }

  return {
    _tag: "DocumentBinding",
    binding: Object.freeze({ ...body, digest: digest.digest }),
  };
}
