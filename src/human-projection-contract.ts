import { Schema } from "effect";
import { NonEmpty, decodeStrict, hasDuplicates, sortedUnique } from "./internal.js";

const LawSchema = Schema.Struct({
  id: NonEmpty,
  rule: NonEmpty,
  verificationClasses: Schema.Array(NonEmpty),
});

const HumanProjectionSchema = Schema.Struct({
  schema: Schema.Literal("contract.human-projection/v1"),
  id: NonEmpty,
  name: NonEmpty,
  authority: Schema.Literal("none"),
  laws: Schema.Array(LawSchema),
  conformanceClasses: Schema.Array(NonEmpty),
  prohibitions: Schema.Array(NonEmpty),
});

export interface HumanProjectionLaw {
  readonly id: string;
  readonly rule: string;
  readonly verificationClasses: readonly string[];
}

export interface HumanProjectionContract {
  readonly schema: "contract.human-projection/v1";
  readonly id: string;
  readonly name: string;
  readonly authority: "none";
  readonly laws: readonly HumanProjectionLaw[];
  readonly conformanceClasses: readonly string[];
  readonly prohibitions: readonly string[];
}

export type HumanProjectionContractResult =
  | { readonly _tag: "HumanProjectionContract"; readonly contract: HumanProjectionContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-human-projection-contract"
        | "duplicate-human-projection-law"
        | "duplicate-verification-class"
        | "duplicate-conformance-class"
        | "duplicate-prohibition";
    };

const DEFAULT_HUMAN_PROJECTION_CONTRACT: unknown = {
  "schema": "contract.human-projection/v1",
  "id": "human-projection-v1",
  "name": "human-facing-semantic-projection",
  "authority": "none",
  "laws": [
    {
      "id": "human-projection-is-non-authoritative",
      "rule": "A human-facing projection may expose, label, summarize, group, navigate, request, preview, approve or contest existing semantics, but it cannot mint semantic state, widen authority, self-authorize effects, or become a competing source of truth.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-meaning-is-source-traceable",
      "rule": "Every material human-facing concept, action and state must bind declared upstream design sources; product vocabulary may differ from internal semantic nouns only while preserving the facts needed for correct understanding and action.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-action-binds-request-authority-effect-and-closure",
      "rule": "A consequential human action projection identifies the semantic request source, governing authority source, effect boundary when one exists, and completion/observation source; a visible signifier alone is never capability or authority.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-state-preserves-semantic-stages",
      "rule": "Human-facing state must not collapse materially distinct stages such as proposed, approved, admitted, dispatched, observed, assessed, blocked, stale or Unknown when the distinction affects correct action or consequence.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-unknown-remains-visible",
      "rule": "Typed Unknown, missing, stale, unsupported, ambiguous or degraded state cannot be rendered as safe, healthy, complete, authorized or successful.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-mechanism-equivalence-preserves-meaning",
      "rule": "Pointer, touch, keyboard, switch, speech, assistive technology, CLI, physical/tangible and other interaction mechanisms may differ while preserving the same material semantic action, authority, consequence and outcome.",
      "verificationClasses": [
        "platform-conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-feedback-does-not-overclaim-outcome",
      "rule": "Human feedback may claim only the completion state established by upstream semantics and Observation; animation, toast, acknowledgement or transport success cannot imply desired-world outcome.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-recovery-claims-match-semantics",
      "rule": "Human-facing recovery language must match actual semantics such as discard, cancel, restore, revert, revoke, compensate, correct, retry, contest or irreversible; a weaker recovery mechanism cannot be labeled as stronger undo or reversal.",
      "verificationClasses": [
        "human-scenario",
        "independent-review"
      ]
    },
    {
      "id": "human-authored-and-machine-derived-state-remain-distinct",
      "rule": "Where material, human-authored input/Intent, machine inference, machine proposal, accepted semantic state, executed effect and observed outcome remain distinguishable and attributable.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "human-attention-does-not-create-authority",
      "rule": "Status, notification, alarm, approval request and interruption are projection/attention classes; salience or urgency never creates semantic or effect authority.",
      "verificationClasses": [
        "human-scenario"
      ]
    },
    {
      "id": "human-safety-claim-binds-real-mechanism",
      "rule": "Where safety is material, a human-facing safety claim may not exceed the physical, engineering, procedural or observational mechanism actually established and verified.",
      "verificationClasses": [
        "human-scenario",
        "independent-review"
      ]
    },
    {
      "id": "human-awareness-does-not-grant-authority",
      "rule": "Presence, awareness, authorship, responsibility, affected-party status and authority remain distinct; collaborative visibility or participation cannot silently become commit or effect authority.",
      "verificationClasses": [
        "human-scenario"
      ]
    }
  ],
  "conformanceClasses": [
    "human-source-traceability",
    "human-action-binding",
    "human-state-stage-preservation",
    "human-unknown-preservation",
    "human-mechanism-equivalence",
    "human-headless-applicability"
  ],
  "prohibitions": [
    "no human-facing semantic source of truth",
    "no UI-generated authority",
    "no renderer/widget identity as semantic identity",
    "no visual-only requirement in shared projection law",
    "no hidden collapse of proposal, dispatch and observed outcome",
    "no safety or reversibility claim stronger than upstream evidence"
  ]
};

export function compileHumanProjectionContract(
  input: unknown = DEFAULT_HUMAN_PROJECTION_CONTRACT,
): HumanProjectionContractResult {
  const decoded = decodeStrict(HumanProjectionSchema, input);
  if (
    decoded === null ||
    decoded.laws.length === 0 ||
    decoded.conformanceClasses.length === 0 ||
    decoded.prohibitions.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-human-projection-contract" };
  }

  if (hasDuplicates(decoded.laws.map((law) => law.id))) {
    return { _tag: "Refusal", reason: "duplicate-human-projection-law" };
  }
  if (decoded.laws.some((law) => hasDuplicates(law.verificationClasses))) {
    return { _tag: "Refusal", reason: "duplicate-verification-class" };
  }
  if (hasDuplicates(decoded.conformanceClasses)) {
    return { _tag: "Refusal", reason: "duplicate-conformance-class" };
  }
  if (hasDuplicates(decoded.prohibitions)) {
    return { _tag: "Refusal", reason: "duplicate-prohibition" };
  }

  return {
    _tag: "HumanProjectionContract",
    contract: Object.freeze({
      schema: "contract.human-projection/v1",
      id: decoded.id,
      name: decoded.name,
      authority: "none",
      laws: Object.freeze(
        [...decoded.laws]
          .map((law) =>
            Object.freeze({
              id: law.id,
              rule: law.rule,
              verificationClasses: Object.freeze(sortedUnique(law.verificationClasses)),
            }),
          )
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
      conformanceClasses: Object.freeze(sortedUnique(decoded.conformanceClasses)),
      prohibitions: Object.freeze([...decoded.prohibitions]),
    }),
  };
}
