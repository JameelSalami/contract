import { Schema } from "effect";

import {
  compareText,
  NonEmpty,
  RefDigestSchema,
  decodeStrict,
  hasDuplicates,
  sortedUnique
} from "./internal.js";
import { canonicalDigest } from "./canonical.js";

const EffectModeSchema = Schema.Literal("read-only", "declared-effects");
const UnknownPolicySchema = Schema.Literal("allow", "fail", "block");

const ExecutionSchema = Schema.Struct({
  repetitions: Schema.Int.pipe(Schema.positive()),
  timeoutMs: Schema.Int.pipe(Schema.positive()),
  maxConcurrency: Schema.Int.pipe(Schema.positive()),
  effectMode: EffectModeSchema,
  allowedCapabilityRefs: Schema.Array(NonEmpty)
});

const AcceptanceSchema = Schema.Struct({
  requiredCheckRefs: Schema.Array(NonEmpty),
  blockerCheckRefs: Schema.Array(NonEmpty),
  unknownPolicy: UnknownPolicySchema
});

const EvidenceSchema = Schema.Struct({
  requiredEvidenceClasses: Schema.Array(NonEmpty)
});

const TestContractSchema = Schema.Struct({
  schema: Schema.Literal("contract.test-contract/v1"),
  id: NonEmpty,
  revision: Schema.Int.pipe(Schema.positive()),
  subjectRefs: Schema.Array(RefDigestSchema),
  caseRefs: Schema.Array(RefDigestSchema),
  checkerRefs: Schema.Array(RefDigestSchema),
  fixtureRefs: Schema.Array(RefDigestSchema),
  environmentRefs: Schema.Array(RefDigestSchema),
  execution: ExecutionSchema,
  acceptance: AcceptanceSchema,
  evidence: EvidenceSchema,
  authority: Schema.Literal("none")
});

export type TestEffectMode = "read-only" | "declared-effects";
export type TestUnknownPolicy = "allow" | "fail" | "block";

export interface TestContractRef {
  readonly ref: string;
  readonly digest: string;
}

export interface TestContract {
  readonly schema: "contract.test-contract/v1";
  readonly id: string;
  readonly revision: number;
  readonly subjectRefs: readonly TestContractRef[];
  readonly caseRefs: readonly TestContractRef[];
  readonly checkerRefs: readonly TestContractRef[];
  readonly fixtureRefs: readonly TestContractRef[];
  readonly environmentRefs: readonly TestContractRef[];
  readonly execution: {
    readonly repetitions: number;
    readonly timeoutMs: number;
    readonly maxConcurrency: number;
    readonly effectMode: TestEffectMode;
    readonly allowedCapabilityRefs: readonly string[];
  };
  readonly acceptance: {
    readonly requiredCheckRefs: readonly string[];
    readonly blockerCheckRefs: readonly string[];
    readonly unknownPolicy: TestUnknownPolicy;
  };
  readonly evidence: {
    readonly requiredEvidenceClasses: readonly string[];
  };
  readonly authority: "none";
  readonly digest: string;
}

export type TestContractResult =
  | { readonly _tag: "TestContract"; readonly contract: TestContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-test-contract"
        | "duplicate-reference"
        | "duplicate-capability-ref"
        | "duplicate-check-ref"
        | "duplicate-evidence-class"
        | "undeclared-blocker-check"
        | "read-only-capability-conflict"
        | "declared-effects-without-capability"
        | "identity-failure";
    };

const duplicateRef = (
  refs: readonly { readonly ref: string; readonly digest: string }[]
): boolean => hasDuplicates(refs.map((item) => item.ref));

const sortRefs = (
  refs: readonly { readonly ref: string; readonly digest: string }[]
): readonly TestContractRef[] =>
  Object.freeze(
    [...refs]
      .map((item) => Object.freeze({ ref: item.ref, digest: item.digest }))
      .sort((a, b) => {
        const byRef = compareText(a.ref, b.ref);
        return byRef === 0 ? compareText(a.digest, b.digest) : byRef;
      })
  );

export function compileTestContract(input: unknown): TestContractResult {
  const decoded = decodeStrict(TestContractSchema, input);
  if (
    decoded === null ||
    decoded.subjectRefs.length === 0 ||
    decoded.caseRefs.length === 0 ||
    decoded.checkerRefs.length === 0 ||
    decoded.acceptance.requiredCheckRefs.length === 0 ||
    decoded.evidence.requiredEvidenceClasses.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-test-contract" };
  }

  if (
    [
      decoded.subjectRefs,
      decoded.caseRefs,
      decoded.checkerRefs,
      decoded.fixtureRefs,
      decoded.environmentRefs
    ].some(duplicateRef)
  ) {
    return { _tag: "Refusal", reason: "duplicate-reference" };
  }

  if (hasDuplicates(decoded.execution.allowedCapabilityRefs)) {
    return { _tag: "Refusal", reason: "duplicate-capability-ref" };
  }

  if (
    hasDuplicates(decoded.acceptance.requiredCheckRefs) ||
    hasDuplicates(decoded.acceptance.blockerCheckRefs)
  ) {
    return { _tag: "Refusal", reason: "duplicate-check-ref" };
  }

  if (hasDuplicates(decoded.evidence.requiredEvidenceClasses)) {
    return { _tag: "Refusal", reason: "duplicate-evidence-class" };
  }

  const requiredChecks = new Set(decoded.acceptance.requiredCheckRefs);
  if (
    decoded.acceptance.blockerCheckRefs.some(
      (ref) => !requiredChecks.has(ref)
    )
  ) {
    return { _tag: "Refusal", reason: "undeclared-blocker-check" };
  }

  if (
    decoded.execution.effectMode === "read-only" &&
    decoded.execution.allowedCapabilityRefs.length > 0
  ) {
    return { _tag: "Refusal", reason: "read-only-capability-conflict" };
  }

  if (
    decoded.execution.effectMode === "declared-effects" &&
    decoded.execution.allowedCapabilityRefs.length === 0
  ) {
    return { _tag: "Refusal", reason: "declared-effects-without-capability" };
  }

  const body = Object.freeze({
    schema: "contract.test-contract/v1" as const,
    id: decoded.id,
    revision: decoded.revision,
    subjectRefs: sortRefs(decoded.subjectRefs),
    caseRefs: sortRefs(decoded.caseRefs),
    checkerRefs: sortRefs(decoded.checkerRefs),
    fixtureRefs: sortRefs(decoded.fixtureRefs),
    environmentRefs: sortRefs(decoded.environmentRefs),
    execution: Object.freeze({
      repetitions: decoded.execution.repetitions,
      timeoutMs: decoded.execution.timeoutMs,
      maxConcurrency: decoded.execution.maxConcurrency,
      effectMode: decoded.execution.effectMode,
      allowedCapabilityRefs: Object.freeze(
        sortedUnique(decoded.execution.allowedCapabilityRefs)
      )
    }),
    acceptance: Object.freeze({
      requiredCheckRefs: Object.freeze(
        sortedUnique(decoded.acceptance.requiredCheckRefs)
      ),
      blockerCheckRefs: Object.freeze(
        sortedUnique(decoded.acceptance.blockerCheckRefs)
      ),
      unknownPolicy: decoded.acceptance.unknownPolicy
    }),
    evidence: Object.freeze({
      requiredEvidenceClasses: Object.freeze(
        sortedUnique(decoded.evidence.requiredEvidenceClasses)
      )
    }),
    authority: "none" as const
  });

  const identity = canonicalDigest(body);
  if (identity._tag !== "Digest") {
    return { _tag: "Refusal", reason: "identity-failure" };
  }

  return {
    _tag: "TestContract",
    contract: Object.freeze({
      ...body,
      digest: identity.digest
    })
  };
}
