import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import { NonEmpty, decodeStrict, hasDuplicates } from "./internal.js";

const ToolingInput = Schema.Struct({
  schema: Schema.Literal("contract.tooling/v1"),
  id: NonEmpty,
  runtimeFamily: NonEmpty,
  requiredCapabilities: Schema.Array(NonEmpty),
  verification: NonEmpty,
  resolution: Schema.Struct({
    preference: Schema.Literal("user-installed-compatible"),
    managedFallback: Schema.Literal("consent-required", "disabled"),
    unsupported: Schema.Literal("refuse"),
  }),
  authority: Schema.Literal("none"),
});

export interface ToolingContract {
  readonly schema: "contract.tooling/v1";
  readonly id: string;
  readonly runtimeFamily: string;
  readonly requiredCapabilities: readonly string[];
  readonly verification: string;
  readonly resolution: {
    readonly preference: "user-installed-compatible";
    readonly managedFallback: "consent-required" | "disabled";
    readonly unsupported: "refuse";
  };
  readonly authority: "none";
  readonly digest: string;
}

export type ToolingContractResult =
  | { readonly _tag: "ToolingContract"; readonly contract: ToolingContract }
  | { readonly _tag: "Refusal"; readonly reason: "invalid-tooling-contract" | "duplicate-tooling-capability" };

const capability = /^[a-z0-9][a-z0-9._:/-]*$/;

/** Compile constraints; discovering or installing runtimes is a consumer-owned effect. */
export function compileToolingContract(input: unknown): ToolingContractResult {
  const decoded = decodeStrict(ToolingInput, input);
  if (
    decoded === null ||
    decoded.requiredCapabilities.length === 0 ||
    decoded.requiredCapabilities.some((entry) => !capability.test(entry))
  ) {
    return { _tag: "Refusal", reason: "invalid-tooling-contract" };
  }
  if (hasDuplicates(decoded.requiredCapabilities)) {
    return { _tag: "Refusal", reason: "duplicate-tooling-capability" };
  }

  const body = {
    schema: "contract.tooling/v1" as const,
    id: decoded.id,
    runtimeFamily: decoded.runtimeFamily,
    requiredCapabilities: [...decoded.requiredCapabilities].sort(),
    verification: decoded.verification,
    resolution: {
      preference: "user-installed-compatible" as const,
      managedFallback: decoded.resolution.managedFallback,
      unsupported: "refuse" as const,
    },
    authority: "none" as const,
  };
  const result = canonicalDigest(body);
  if (result._tag !== "Digest") {
    return { _tag: "Refusal", reason: "invalid-tooling-contract" };
  }
  return { _tag: "ToolingContract", contract: Object.freeze({
    ...body,
    requiredCapabilities: Object.freeze(body.requiredCapabilities),
    resolution: Object.freeze(body.resolution),
    digest: result.digest,
  }) };
}
