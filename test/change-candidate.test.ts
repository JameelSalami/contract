import assert from "node:assert/strict";
import test from "node:test";
import { compileChangeCandidate } from "../src/change-candidate.js";

test("change candidate is evidence-bound and permanently non-executable", () => {
  const result = compileChangeCandidate({
    id: "repair:x",
    reason: "conformance-failure",
    targetRefs: ["implementation:b", "implementation:a"],
    evidenceRefs: ["fixture:1"],
    obligationRefs: ["constraint:known"]
  });
  assert.equal(result._tag, "ChangeCandidate");
  if (result._tag === "ChangeCandidate") {
    assert.equal(result.candidate.executable, false);
    assert.deepEqual(result.candidate.targetRefs, ["implementation:a", "implementation:b"]);
  }
});

test("attempted executable authority fails closed", () => {
  assert.equal(compileChangeCandidate({
    id: "repair:x",
    reason: "conformance-failure",
    targetRefs: ["implementation:a"],
    evidenceRefs: ["fixture:1"],
    obligationRefs: [],
    executable: true
  })._tag, "Refusal");
});
