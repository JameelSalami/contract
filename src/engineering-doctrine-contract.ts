import { Schema } from "effect";
import { NonEmpty, decodeStrict, hasDuplicates } from "./internal.js";

const RuleSchema = Schema.Struct({
  id: NonEmpty,
  rule: NonEmpty,
});

const ExemplarSchema = Schema.Struct({
  project: NonEmpty,
  lesson: NonEmpty,
});

const EngineeringDoctrineSchema = Schema.Struct({
  schema: Schema.Literal("contract.engineering-doctrine/v1"),
  id: NonEmpty,
  authority: Schema.Literal("none"),
  complexity: Schema.Struct({
    measure: Schema.Literal("consumer-concepts"),
    deepModule: Schema.Literal("small-stable-interface-hiding-coherent-complexity"),
    lineCountIsFinding: Schema.Literal(false),
    shallowForwardingAllowed: Schema.Literal(false),
  }),
  boundaries: Schema.Struct({
    openInput: Schema.Literal("compile-before-policy"),
    semanticAlternatives: Schema.Literal("exhaustive-tagged-data"),
    expectedFailures: Schema.Literal("typed"),
    unknown: Schema.Literal("explicit-data"),
    effectCompletion: Schema.Literal("owner-attributable-evidence"),
  }),
  ownership: Schema.Struct({
    oneSemanticOwner: Schema.Literal(true),
    workflowOwnsPolicy: Schema.Literal(false),
    projectionsAuthoritative: Schema.Literal(false),
    mechanismOwnsSemanticPolicy: Schema.Literal(false),
  }),
  verification: Schema.Struct({
    stablePublicSeams: Schema.Literal(true),
    independentOracle: Schema.Literal("required-consequential", "preferred"),
    mutationFalsifiers: Schema.Literal("required-when-practical"),
    limitationsFirstClass: Schema.Literal(true),
    workerContextDelivery: Schema.Literal("must-be-proven"),
  }),
  rules: Schema.Array(RuleSchema),
  exemplars: Schema.Array(ExemplarSchema),
});

export interface EngineeringDoctrineContract {
  readonly schema: "contract.engineering-doctrine/v1";
  readonly id: string;
  readonly authority: "none";
  readonly complexity: {
    readonly measure: "consumer-concepts";
    readonly deepModule: "small-stable-interface-hiding-coherent-complexity";
    readonly lineCountIsFinding: false;
    readonly shallowForwardingAllowed: false;
  };
  readonly boundaries: {
    readonly openInput: "compile-before-policy";
    readonly semanticAlternatives: "exhaustive-tagged-data";
    readonly expectedFailures: "typed";
    readonly unknown: "explicit-data";
    readonly effectCompletion: "owner-attributable-evidence";
  };
  readonly ownership: {
    readonly oneSemanticOwner: true;
    readonly workflowOwnsPolicy: false;
    readonly projectionsAuthoritative: false;
    readonly mechanismOwnsSemanticPolicy: false;
  };
  readonly verification: {
    readonly stablePublicSeams: true;
    readonly independentOracle: "required-consequential" | "preferred";
    readonly mutationFalsifiers: "required-when-practical";
    readonly limitationsFirstClass: true;
    readonly workerContextDelivery: "must-be-proven";
  };
  readonly rules: readonly { readonly id: string; readonly rule: string }[];
  readonly exemplars: readonly { readonly project: string; readonly lesson: string }[];
}

export type EngineeringDoctrineContractResult =
  | { readonly _tag: "EngineeringDoctrineContract"; readonly contract: EngineeringDoctrineContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-engineering-doctrine"
        | "duplicate-doctrine-rule"
        | "duplicate-doctrine-exemplar";
    };

const ENGINEERING_DOCTRINE_V1: EngineeringDoctrineContract = Object.freeze({
  schema: "contract.engineering-doctrine/v1",
  id: "engineering-doctrine-v1",
  authority: "none",
  complexity: Object.freeze({
    measure: "consumer-concepts",
    deepModule: "small-stable-interface-hiding-coherent-complexity",
    lineCountIsFinding: false,
    shallowForwardingAllowed: false,
  }),
  boundaries: Object.freeze({
    openInput: "compile-before-policy",
    semanticAlternatives: "exhaustive-tagged-data",
    expectedFailures: "typed",
    unknown: "explicit-data",
    effectCompletion: "owner-attributable-evidence",
  }),
  ownership: Object.freeze({
    oneSemanticOwner: true,
    workflowOwnsPolicy: false,
    projectionsAuthoritative: false,
    mechanismOwnsSemanticPolicy: false,
  }),
  verification: Object.freeze({
    stablePublicSeams: true,
    independentOracle: "required-consequential",
    mutationFalsifiers: "required-when-practical",
    limitationsFirstClass: true,
    workerContextDelivery: "must-be-proven",
  }),
  rules: Object.freeze([
    { id: "push-complexity-down", rule: "Callers do not reconstruct validation order, rollback, crash recovery, provenance, vendor interpretation, or effect-closure law that a deeper owner can hide." },
    { id: "complete-semantic-question", rule: "A trusted domain function answers one complete meaningful question and returns a closed typed disposition rather than leaking a sequence of policy checks to callers." },
    { id: "compile-open-input", rule: "Provider, vendor, native, user, file, network, and other open input is compiled at an explicit boundary before trusted semantic policy consumes it." },
    { id: "unknown-remains-data", rule: "Unknown, degraded, stale, blocked, unsupported, and uncertain states remain explicit typed data and are never converted into optimistic success." },
    { id: "single-semantic-owner", rule: "One declared owner changes each semantic state; orchestration, adapters, mechanisms, projections, proposals, and evidence producers do not become competing writers." },
    { id: "composition-owns-nothing", rule: "Workflow, CLI, and runtime composition route among owners and mechanisms but own no canonical semantic state or effect authority." },
    { id: "projection-is-disposable", rule: "Projections and materializations are deterministic, non-authoritative, reconstructable, and cannot mutate the state they project." },
    { id: "mechanism-is-not-meaning", rule: "DBMS, storage engine, model/provider, process, container, network, driver, device, scheduler, and similar mechanisms do not acquire semantic policy or identity merely because they realize work." },
    { id: "effect-closure-needs-owner-evidence", rule: "Dispatch, acknowledgement, tool success, process exit, or model claims do not establish external consequence; closure requires attributable evidence from the owning boundary." },
    { id: "persistence-hides-durability", rule: "Persistence modules hide atomicity, CAS/currentness, journaling, crash recovery, rollback, receipts, and integrity behind stable interfaces rather than exporting those mechanics to every caller." },
    { id: "truthful-recovery", rule: "Recovery language matches the actual owning mechanism: cancel, correct, retry, revoke, compensate, restore/revert, delete/forget, or irreversible; false undo is forbidden." },
    { id: "sensitive-input-boundary", rule: "Sensitive values remain at their owning boundary where possible; downstream cognition receives opaque references or bounded results rather than raw secrets." },
    { id: "telemetry-below-observation", rule: "High-rate/raw telemetry and mechanism output remain below the semantic Observation boundary unless explicitly admitted as bounded attributable evidence." },
    { id: "portable-core-is-mechanism-independent", rule: "Portable trusted TypeScript code cannot depend on platform-specific or Node-only mechanisms unless it is explicitly a platform/runtime adapter." },
    { id: "test-stable-seams", rule: "Tests target stable public contracts and semantic laws rather than helper decomposition or incidental implementation structure." },
    { id: "independent-oracle", rule: "Consequential or high-risk behavior uses independently controlled verification where practical; product builders must not be able to silently weaken their acceptance oracle." },
    { id: "falsifier-required", rule: "Important laws should have at least one known non-equivalent falsifier or mutation when practical so the oracle demonstrates discriminatory power." },
    { id: "limitations-are-evidence", rule: "Unverified platforms, missing physical evidence, unavailable mechanisms, and unresolved consequences are preserved as explicit limitations rather than manufactured closure." },
    { id: "architectural-locality", rule: "A fresh engineer or agent should be able to locate feature -> public interface -> owning implementation -> tests without loading unrelated subsystems." },
  ].map((item) => Object.freeze(item))),
  exemplars: Object.freeze([
    { project: "actance", lesson: "Typed semantic evaluators such as currentness and lease law hide validation order behind complete domain questions." },
    { project: "knowledge-runtime", lesson: "Transactional mutation hides journal, current-pointer, crash-recovery, and replay mechanics behind one durable operation." },
    { project: "scriptorium", lesson: "Lifecycle operations such as backup/restore hide coherent stop, archive, verify, rollback, restart, and receipt complexity behind small interfaces." },
    { project: "iot-control", lesson: "Hostile vendor/native values compile to closed semantic state or explicit Unknown before policy; dispatch remains separate from consequence." },
    { project: "devlock", lesson: "A single admission boundary enforces provenance and binding laws, while also warning against allowing one central kernel to own every independent semantic concern." },
    { project: "build-lab", lesson: "Frozen independent oracles, mutation campaigns, and authority:none evidence prevent builders from self-certifying semantic success." },
    { project: "assistant-v1-history", lesson: "Small human-facing projections, replaceable mechanism services, truthful state, and recovery semantics are reusable even though the former World ontology is not." },
  ].map((item) => Object.freeze(item))),
});

export function compileEngineeringDoctrineContract(input: unknown = ENGINEERING_DOCTRINE_V1): EngineeringDoctrineContractResult {
  const decoded = decodeStrict(EngineeringDoctrineSchema, input);
  if (decoded === null || decoded.rules.length === 0 || decoded.exemplars.length === 0) {
    return { _tag: "Refusal", reason: "invalid-engineering-doctrine" };
  }
  if (hasDuplicates(decoded.rules.map((item) => item.id))) {
    return { _tag: "Refusal", reason: "duplicate-doctrine-rule" };
  }
  if (hasDuplicates(decoded.exemplars.map((item) => item.project))) {
    return { _tag: "Refusal", reason: "duplicate-doctrine-exemplar" };
  }

  return {
    _tag: "EngineeringDoctrineContract",
    contract: Object.freeze({
      schema: "contract.engineering-doctrine/v1",
      id: decoded.id,
      authority: "none",
      complexity: Object.freeze({ ...decoded.complexity }),
      boundaries: Object.freeze({ ...decoded.boundaries }),
      ownership: Object.freeze({ ...decoded.ownership }),
      verification: Object.freeze({ ...decoded.verification }),
      rules: Object.freeze(decoded.rules.map((item) => Object.freeze({ ...item }))),
      exemplars: Object.freeze(decoded.exemplars.map((item) => Object.freeze({ ...item }))),
    }),
  };
}
