import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import { NonEmpty, decodeStrict, hasDuplicates } from "./internal.js";

const ImplementationInput = Schema.Struct({
  schema: Schema.Literal("contract.implementation/v1"),
  id: NonEmpty,
  interface: Schema.Struct({
    id: NonEmpty,
    version: NonEmpty,
  }),
  requiredCapabilities: Schema.Array(NonEmpty),
  selection: Schema.Struct({
    mode: Schema.Literal("explicit-binding"),
    unavailable: Schema.Literal("refuse"),
    migration: Schema.Literal("verified-export-import"),
  }),
  authority: Schema.Literal("none"),
});

export interface ImplementationContract {
  readonly schema: "contract.implementation/v1";
  readonly id: string;
  readonly interface: { readonly id: string; readonly version: string };
  readonly requiredCapabilities: readonly string[];
  readonly selection: {
    readonly mode: "explicit-binding";
    readonly unavailable: "refuse";
    readonly migration: "verified-export-import";
  };
  readonly authority: "none";
  readonly digest: string;
}

export type ImplementationContractResult =
  | { readonly _tag: "ImplementationContract"; readonly contract: ImplementationContract }
  | { readonly _tag: "Refusal"; readonly reason: "invalid-implementation-contract" | "duplicate-implementation-capability" };

const capability = /^[a-z0-9][a-z0-9._:/-]*$/;

/** Bind a neutral interface and requirements, not any specific database or driver. */
export function compileImplementationContract(input: unknown): ImplementationContractResult {
  const decoded = decodeStrict(ImplementationInput, input);
  if (
    decoded === null ||
    decoded.requiredCapabilities.length === 0 ||
    decoded.requiredCapabilities.some((entry) => !capability.test(entry))
  ) {
    return { _tag: "Refusal", reason: "invalid-implementation-contract" };
  }
  if (hasDuplicates(decoded.requiredCapabilities)) {
    return { _tag: "Refusal", reason: "duplicate-implementation-capability" };
  }
  const body = {
    schema: "contract.implementation/v1" as const,
    id: decoded.id,
    interface: { id: decoded.interface.id, version: decoded.interface.version },
    requiredCapabilities: [...decoded.requiredCapabilities].sort(),
    selection: {
      mode: "explicit-binding" as const,
      unavailable: "refuse" as const,
      migration: "verified-export-import" as const,
    },
    authority: "none" as const,
  };
  const result = canonicalDigest(body);
  if (result._tag !== "Digest") {
    return { _tag: "Refusal", reason: "invalid-implementation-contract" };
  }
  return { _tag: "ImplementationContract", contract: Object.freeze({
    ...body,
    interface: Object.freeze(body.interface),
    requiredCapabilities: Object.freeze(body.requiredCapabilities),
    selection: Object.freeze(body.selection),
    digest: result.digest,
  }) };
}
