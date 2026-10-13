import assert from "node:assert/strict";
import test from "node:test";
import { observeDecisionBoundaryDrift } from "../src/decision-boundary.js";

test("decision displacement toward automation is explicit authority drift", () => {
  const result = observeDecisionBoundaryDrift(
    { id: "maintenance-disposition", ownerRef: "role:reliability-engineer", mode: "human-decision", evidenceRefs: ["adr:7"] },
    { id: "maintenance-disposition", ownerRef: "service:auto", mode: "automation-may-decide", evidenceRefs: ["implementation:v2"] }
  );
  assert.equal(result.changed, true);
  assert.equal(result.automationEscalation, true);
  assert.equal(result.executable, false);
});

test("same boundary is not drift", () => {
  const boundary = { id: "review", ownerRef: "role:engineer", mode: "automation-may-recommend" as const, evidenceRefs: [] };
  assert.deepEqual(observeDecisionBoundaryDrift(boundary, boundary), {
    schema: "contract.decision-boundary-drift/v1",
    boundaryId: "review",
    changed: false,
    automationEscalation: false,
    expected: boundary,
    observed: boundary,
    executable: false
  });
});
