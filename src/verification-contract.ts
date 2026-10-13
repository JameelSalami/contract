import { Schema } from "effect";
import { NonEmpty, decodeStrict, hasDuplicates, sortedUnique } from "./internal.js";

const StageSchema = Schema.Literal("pre-code", "post-code", "both");

const EvidenceClassSchema = Schema.Struct({
  id: NonEmpty,
  meaning: NonEmpty,
  stage: StageSchema,
});

const ObligationSchema = Schema.Struct({
  id: NonEmpty,
  statement: NonEmpty,
  sourceRefs: Schema.Array(NonEmpty),
  targetRefs: Schema.Array(NonEmpty),
  verificationClasses: Schema.Array(NonEmpty),
  required: Schema.Boolean,
  stage: StageSchema,
});

const VerificationContractSchema = Schema.Struct({
  schema: Schema.Literal("contract.verification-contract/v1"),
  id: NonEmpty,
  subjectRefs: Schema.Array(NonEmpty),
  evidenceClasses: Schema.Array(EvidenceClassSchema),
  obligations: Schema.Array(ObligationSchema),
  authority: Schema.Literal("none"),
});

export type VerificationStage = "pre-code" | "post-code" | "both";

export interface VerificationContract {
  readonly schema: "contract.verification-contract/v1";
  readonly id: string;
  readonly subjectRefs: readonly string[];
  readonly evidenceClasses: readonly {
    readonly id: string;
    readonly meaning: string;
    readonly stage: VerificationStage;
  }[];
  readonly obligations: readonly {
    readonly id: string;
    readonly statement: string;
    readonly sourceRefs: readonly string[];
    readonly targetRefs: readonly string[];
    readonly verificationClasses: readonly string[];
    readonly required: boolean;
    readonly stage: VerificationStage;
  }[];
  readonly authority: "none";
}

export type VerificationContractResult =
  | { readonly _tag: "VerificationContract"; readonly contract: VerificationContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-verification-contract"
        | "duplicate-evidence-class"
        | "duplicate-obligation"
        | "undeclared-verification-class";
    };

export function compileVerificationContract(input: unknown): VerificationContractResult {
  const decoded = decodeStrict(VerificationContractSchema, input);
  if (
    decoded === null ||
    decoded.subjectRefs.length === 0 ||
    decoded.evidenceClasses.length === 0 ||
    decoded.obligations.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-verification-contract" };
  }

  const classIds = decoded.evidenceClasses.map((item) => item.id);
  if (hasDuplicates(classIds)) {
    return { _tag: "Refusal", reason: "duplicate-evidence-class" };
  }

  const obligationIds = decoded.obligations.map((item) => item.id);
  if (hasDuplicates(obligationIds)) {
    return { _tag: "Refusal", reason: "duplicate-obligation" };
  }

  const knownClasses = new Set(classIds);
  if (
    decoded.obligations.some(
      (obligation) =>
        obligation.sourceRefs.length === 0 ||
        obligation.targetRefs.length === 0 ||
        obligation.verificationClasses.length === 0 ||
        hasDuplicates(obligation.verificationClasses) ||
        obligation.verificationClasses.some((id) => !knownClasses.has(id)),
    )
  ) {
    return { _tag: "Refusal", reason: "undeclared-verification-class" };
  }

  return {
    _tag: "VerificationContract",
    contract: Object.freeze({
      schema: "contract.verification-contract/v1",
      id: decoded.id,
      subjectRefs: Object.freeze(sortedUnique(decoded.subjectRefs)),
      evidenceClasses: Object.freeze(
        [...decoded.evidenceClasses]
          .map((item) => Object.freeze({ id: item.id, meaning: item.meaning, stage: item.stage }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
      obligations: Object.freeze(
        [...decoded.obligations]
          .map((item) =>
            Object.freeze({
              id: item.id,
              statement: item.statement,
              sourceRefs: Object.freeze(sortedUnique(item.sourceRefs)),
              targetRefs: Object.freeze(sortedUnique(item.targetRefs)),
              verificationClasses: Object.freeze(sortedUnique(item.verificationClasses)),
              required: item.required,
              stage: item.stage,
            }),
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
      authority: "none",
    }),
  };
}
