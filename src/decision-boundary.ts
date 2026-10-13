export type DecisionMode =
  | "human-decision"
  | "automation-may-recommend"
  | "automation-may-decide";

export interface DecisionBoundary {
  readonly id: string;
  readonly ownerRef: string;
  readonly mode: DecisionMode;
  readonly evidenceRefs: readonly string[];
}

export interface DecisionBoundaryDrift {
  readonly schema: "contract.decision-boundary-drift/v1";
  readonly boundaryId: string;
  readonly changed: boolean;
  readonly automationEscalation: boolean;
  readonly expected: DecisionBoundary;
  readonly observed: DecisionBoundary;
  readonly executable: false;
}

const rank: Readonly<Record<DecisionMode, number>> = {
  "human-decision": 0,
  "automation-may-recommend": 1,
  "automation-may-decide": 2,
};

export function observeDecisionBoundaryDrift(
  expected: DecisionBoundary,
  observed: DecisionBoundary,
): DecisionBoundaryDrift {
  if (expected.id !== observed.id) {
    throw new TypeError("decision boundary ids must match");
  }

  return Object.freeze({
    schema: "contract.decision-boundary-drift/v1",
    boundaryId: expected.id,
    changed:
      expected.ownerRef !== observed.ownerRef ||
      expected.mode !== observed.mode ||
      JSON.stringify(expected.evidenceRefs) !== JSON.stringify(observed.evidenceRefs),
    automationEscalation: rank[observed.mode] > rank[expected.mode],
    expected,
    observed,
    executable: false,
  });
}
