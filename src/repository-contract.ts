import { Schema } from "effect";
import {
  compareText,
  NonEmpty,
  decodeStrict,
  hasDuplicates,
  sortedUnique,
} from "./internal.js";

const ModuleSchema = Schema.Struct({
  id: NonEmpty,
  source: NonEmpty,
  exports: Schema.Array(NonEmpty),
  guarantees: Schema.Array(NonEmpty),
});

const RepositoryContractSchema = Schema.Struct({
  schema: Schema.Literal("contract.repository-contract/v1"),
  package: Schema.Struct({
    name: Schema.Literal("contract"),
    version: NonEmpty,
  }),
  implementation: Schema.Struct({
    language: Schema.Literal("typescript"),
    effect: Schema.Literal("required"),
    xstate: Schema.Literal("optional-not-core"),
  }),
  rules: Schema.Struct({
    markdownDocs: Schema.Literal("forbidden"),
    wireContracts: Schema.Literal("plain-json"),
    generatedChecks: Schema.Literal("read-only"),
    changeCandidatesExecutable: Schema.Literal(false),
    domainSemantics: Schema.Literal("project-local"),
  }),
  modules: Schema.Array(ModuleSchema),
});

export interface RepositoryModuleContract {
  readonly id: string;
  readonly source: string;
  readonly exports: readonly string[];
  readonly guarantees: readonly string[];
}

export interface RepositoryContract {
  readonly schema: "contract.repository-contract/v1";
  readonly package: {
    readonly name: "contract";
    readonly version: string;
  };
  readonly implementation: {
    readonly language: "typescript";
    readonly effect: "required";
    readonly xstate: "optional-not-core";
  };
  readonly rules: {
    readonly markdownDocs: "forbidden";
    readonly wireContracts: "plain-json";
    readonly generatedChecks: "read-only";
    readonly changeCandidatesExecutable: false;
    readonly domainSemantics: "project-local";
  };
  readonly modules: readonly RepositoryModuleContract[];
}

export type RepositoryContractResult =
  | { readonly _tag: "RepositoryContract"; readonly contract: RepositoryContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-repository-contract"
        | "invalid-module-contract"
        | "duplicate-module-id"
        | "duplicate-module-source"
        | "duplicate-public-export";
    };

export function compileRepositoryContract(
  input: unknown,
): RepositoryContractResult {
  const decoded = decodeStrict(RepositoryContractSchema, input);
  if (decoded === null || decoded.modules.length === 0) {
    return { _tag: "Refusal", reason: "invalid-repository-contract" };
  }

  const ids = decoded.modules.map((module) => module.id);
  const sources = decoded.modules.map((module) => module.source);
  const exports = decoded.modules.flatMap((module) => module.exports);

  if (hasDuplicates(ids)) {
    return { _tag: "Refusal", reason: "duplicate-module-id" };
  }
  if (hasDuplicates(sources)) {
    return { _tag: "Refusal", reason: "duplicate-module-source" };
  }
  if (hasDuplicates(exports)) {
    return { _tag: "Refusal", reason: "duplicate-public-export" };
  }

  for (const module of decoded.modules) {
    if (
      !module.source.startsWith("src/") ||
      !module.source.endsWith(".ts") ||
      module.source.includes("..") ||
      module.exports.length !== 1 ||
      module.guarantees.length === 0
    ) {
      return { _tag: "Refusal", reason: "invalid-module-contract" };
    }
  }

  const modules = decoded.modules
    .map((module) => ({
      id: module.id,
      source: module.source,
      exports: sortedUnique(module.exports),
      guarantees: [...module.guarantees],
    }))
    .sort((a, b) => compareText(a.id, b.id));

  return {
    _tag: "RepositoryContract",
    contract: Object.freeze({
      schema: "contract.repository-contract/v1",
      package: Object.freeze({
        name: "contract",
        version: decoded.package.version,
      }),
      implementation: Object.freeze({
        language: "typescript",
        effect: "required",
        xstate: "optional-not-core",
      }),
      rules: Object.freeze({
        markdownDocs: "forbidden",
        wireContracts: "plain-json",
        generatedChecks: "read-only",
        changeCandidatesExecutable: false,
        domainSemantics: "project-local",
      }),
      modules: Object.freeze(modules.map((module) => Object.freeze(module))),
    }),
  };
}
