import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import {
  IdentitySchema,
  NonEmpty,
  RefDigestSchema,
  decodeStrict,
  sortedUnique,
} from "./internal.js";

const InputSchema = Schema.Struct({
  subject: RefDigestSchema,
  checker: IdentitySchema,
  outcome: Schema.Literal("passed", "failed", "partial", "blocked"),
  evidenceRefs: Schema.Array(NonEmpty),
  caseRefs: Schema.Array(NonEmpty),
  summary: NonEmpty,
});

export interface VerificationReceipt {
  readonly schema: "contract.verification-receipt/v1";
  readonly subject: { readonly ref: string; readonly digest: string };
  readonly checker: { readonly id: string; readonly version: string };
  readonly outcome: "passed" | "failed" | "partial" | "blocked";
  readonly evidenceRefs: readonly string[];
  readonly caseRefs: readonly string[];
  readonly summary: string;
  readonly authority: "none";
  readonly digest: string;
}

export type VerificationReceiptResult =
  | {
      readonly _tag: "VerificationReceipt";
      readonly receipt: VerificationReceipt;
    }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-verification-input"
        | "verification-requires-evidence"
        | "receipt-not-canonicalizable";
    };

export function compileVerificationReceipt(
  input: unknown,
): VerificationReceiptResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null) {
    return { _tag: "Refusal", reason: "invalid-verification-input" };
  }
  const evidenceRefs = sortedUnique(decoded.evidenceRefs);
  if (evidenceRefs.length === 0) {
    return { _tag: "Refusal", reason: "verification-requires-evidence" };
  }

  const body = {
    schema: "contract.verification-receipt/v1" as const,
    subject: {
      ref: decoded.subject.ref,
      digest: decoded.subject.digest,
    },
    checker: {
      id: decoded.checker.id,
      version: decoded.checker.version,
    },
    outcome: decoded.outcome,
    evidenceRefs,
    caseRefs: sortedUnique(decoded.caseRefs),
    summary: decoded.summary,
    authority: "none" as const,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "receipt-not-canonicalizable" };
  }

  return {
    _tag: "VerificationReceipt",
    receipt: Object.freeze({
      ...body,
      subject: Object.freeze(body.subject),
      checker: Object.freeze(body.checker),
      evidenceRefs: Object.freeze(body.evidenceRefs),
      caseRefs: Object.freeze(body.caseRefs),
      digest: digest.digest,
    }),
  };
}
