import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import { NonEmpty, decodeStrict, sortedUnique } from "./internal.js";

const InputSchema = Schema.Struct({
  id: NonEmpty,
  reason: NonEmpty,
  targetRefs: Schema.Array(NonEmpty),
  evidenceRefs: Schema.Array(NonEmpty),
  obligationRefs: Schema.Array(NonEmpty),
});

export interface ChangeCandidate {
  readonly schema: "contract.change-candidate/v1";
  readonly id: string;
  readonly reason: string;
  readonly targetRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly obligationRefs: readonly string[];
  readonly executable: false;
  readonly digest: string;
}

export type ChangeCandidateResult =
  | { readonly _tag: "ChangeCandidate"; readonly candidate: ChangeCandidate }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-change-candidate"
        | "change-candidate-requires-target"
        | "change-candidate-requires-evidence"
        | "candidate-not-canonicalizable";
    };

export function compileChangeCandidate(input: unknown): ChangeCandidateResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null) {
    return { _tag: "Refusal", reason: "invalid-change-candidate" };
  }

  const targetRefs = sortedUnique(decoded.targetRefs);
  const evidenceRefs = sortedUnique(decoded.evidenceRefs);
  if (targetRefs.length === 0) {
    return { _tag: "Refusal", reason: "change-candidate-requires-target" };
  }
  if (evidenceRefs.length === 0) {
    return { _tag: "Refusal", reason: "change-candidate-requires-evidence" };
  }

  const body = {
    schema: "contract.change-candidate/v1" as const,
    id: decoded.id,
    reason: decoded.reason,
    targetRefs,
    evidenceRefs,
    obligationRefs: sortedUnique(decoded.obligationRefs),
    executable: false as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "candidate-not-canonicalizable" };
  }

  return {
    _tag: "ChangeCandidate",
    candidate: Object.freeze({
      ...body,
      targetRefs: Object.freeze(body.targetRefs),
      evidenceRefs: Object.freeze(body.evidenceRefs),
      obligationRefs: Object.freeze(body.obligationRefs),
      digest: digest.digest,
    }),
  };
}
