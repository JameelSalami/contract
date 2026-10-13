import { Schema } from "effect";
import { NonEmpty, decodeStrict, hasDuplicates } from "./internal.js";

const ExportSchema = Schema.Struct({
  name: NonEmpty,
  arity: Schema.Int.pipe(Schema.nonNegative()),
  returns: Schema.optional(NonEmpty),
});

const DeepModuleSchema = Schema.Struct({
  schema: Schema.Literal("contract.deep-module/v1"),
  module: NonEmpty,
  source: Schema.optional(NonEmpty),
  public: Schema.Struct({
    exports: Schema.Array(ExportSchema),
  }),
  encapsulated: Schema.Array(NonEmpty),
  guarantees: Schema.Array(NonEmpty),
  depth: Schema.Struct({
    maxPublicSymbols: Schema.Int.pipe(Schema.positive()),
    maxArgsPerExport: Schema.Int.pipe(Schema.nonNegative()),
  }),
  authority: Schema.Literal("none"),
});

export interface DeepModuleContract {
  readonly schema: "contract.deep-module/v1";
  readonly module: string;
  readonly source?: string;
  readonly public: {
    readonly exports: readonly {
      readonly name: string;
      readonly arity: number;
      readonly returns?: string;
    }[];
  };
  readonly encapsulated: readonly string[];
  readonly guarantees: readonly string[];
  readonly depth: {
    readonly maxPublicSymbols: number;
    readonly maxArgsPerExport: number;
  };
  readonly authority: "none";
}

export type DeepModuleContractResult =
  | { readonly _tag: "DeepModuleContract"; readonly contract: DeepModuleContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-deep-module-contract"
        | "duplicate-public-export"
        | "public-surface-budget-exceeded"
        | "argument-budget-exceeded";
    };

export function compileDeepModuleContract(input: unknown): DeepModuleContractResult {
  const decoded = decodeStrict(DeepModuleSchema, input);
  if (
    decoded === null ||
    decoded.public.exports.length === 0 ||
    decoded.encapsulated.length === 0 ||
    decoded.guarantees.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-deep-module-contract" };
  }

  if (hasDuplicates(decoded.public.exports.map((item) => item.name))) {
    return { _tag: "Refusal", reason: "duplicate-public-export" };
  }

  if (decoded.public.exports.length > decoded.depth.maxPublicSymbols) {
    return { _tag: "Refusal", reason: "public-surface-budget-exceeded" };
  }

  if (decoded.public.exports.some((item) => item.arity > decoded.depth.maxArgsPerExport)) {
    return { _tag: "Refusal", reason: "argument-budget-exceeded" };
  }

  const exports = [...decoded.public.exports]
    .map((item) => Object.freeze({
      name: item.name,
      arity: item.arity,
      ...(item.returns === undefined ? {} : { returns: item.returns }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    _tag: "DeepModuleContract",
    contract: Object.freeze({
      schema: "contract.deep-module/v1",
      module: decoded.module,
      ...(decoded.source === undefined ? {} : { source: decoded.source }),
      public: Object.freeze({ exports: Object.freeze(exports) }),
      encapsulated: Object.freeze([...decoded.encapsulated]),
      guarantees: Object.freeze([...decoded.guarantees]),
      depth: Object.freeze({
        maxPublicSymbols: decoded.depth.maxPublicSymbols,
        maxArgsPerExport: decoded.depth.maxArgsPerExport,
      }),
      authority: "none",
    }),
  };
}
