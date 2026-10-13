import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import {
  compareText,
  IdentitySchema,
  NonEmpty,
  RefDigestSchema,
  decodeStrict,
  hasDuplicates,
} from "./internal.js";

const OutcomeSchema = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal("verified"),
    resultRef: NonEmpty,
    resultDigest: RefDigestSchema.fields.digest,
  }),
  Schema.Struct({
    kind: Schema.Literal("refused"),
    code: NonEmpty,
  }),
);

const CompileInputSchema = Schema.Struct({
  compiler: IdentitySchema,
  sources: Schema.Array(RefDigestSchema),
  outcome: OutcomeSchema,
});

export interface CompileReceipt {
  readonly schema: "contract.compile-receipt/v1";
  readonly compiler: { readonly id: string; readonly version: string };
  readonly sources: readonly { readonly ref: string; readonly digest: string }[];
  readonly outcome:
    | {
        readonly kind: "verified";
        readonly resultRef: string;
        readonly resultDigest: string;
      }
    | { readonly kind: "refused"; readonly code: string };
  readonly digest: string;
}

export type CompileReceiptResult =
  | { readonly _tag: "CompileReceipt"; readonly receipt: CompileReceipt }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-compile-input"
        | "duplicate-source-ref"
        | "receipt-not-canonicalizable";
    };

export function compileReceipt(input: unknown): CompileReceiptResult {
  const decoded = decodeStrict(CompileInputSchema, input);
  if (decoded === null || decoded.sources.length === 0) {
    return { _tag: "Refusal", reason: "invalid-compile-input" };
  }

  const refs = decoded.sources.map((source) => source.ref);
  if (hasDuplicates(refs)) {
    return { _tag: "Refusal", reason: "duplicate-source-ref" };
  }

  const body = {
    schema: "contract.compile-receipt/v1" as const,
    compiler: {
      id: decoded.compiler.id,
      version: decoded.compiler.version,
    },
    sources: [...decoded.sources]
      .map((source) => ({ ref: source.ref, digest: source.digest }))
      .sort((a, b) => compareText(a.ref, b.ref)),
    outcome:
      decoded.outcome.kind === "verified"
        ? {
            kind: "verified" as const,
            resultRef: decoded.outcome.resultRef,
            resultDigest: decoded.outcome.resultDigest,
          }
        : {
            kind: "refused" as const,
            code: decoded.outcome.code,
          },
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "receipt-not-canonicalizable" };
  }

  return {
    _tag: "CompileReceipt",
    receipt: Object.freeze({
      ...body,
      sources: Object.freeze(body.sources.map((source) => Object.freeze(source))),
      outcome: Object.freeze(body.outcome),
      digest: digest.digest,
    }),
  };
}
