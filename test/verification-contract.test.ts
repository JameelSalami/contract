import assert from "node:assert/strict";
import test from "node:test";
import { compileVerificationContract } from "../src/verification-contract.js";

const input = {
  schema: "contract.verification-contract/v1",
  id: "software-projection",
  subjectRefs: ["ir:software"],
  evidenceClasses: [
    { id: "conformance", meaning: "executable semantic examples", stage: "post-code" },
    { id: "mutation", meaning: "known non-equivalent falsifiers", stage: "post-code" }
  ],
  obligations: [
    {
      id: "V-CANDIDATE",
      statement: "software output remains non-executable",
      sourceRefs: ["semantic:mutation-candidate#non-executable"],
      targetRefs: ["module:software-conformance"],
      verificationClasses: ["conformance", "mutation"],
      required: true,
      stage: "both"
    }
  ],
  authority: "none"
} as const;

test("verification contract freezes obligations before evidence receipts exist", () => {
  const result = compileVerificationContract(input);
  assert.equal(result._tag, "VerificationContract");
  if (result._tag !== "VerificationContract") return;
  assert.deepEqual(result.contract.obligations[0]?.verificationClasses, ["conformance", "mutation"]);
});

test("verification contract rejects undeclared evidence classes and duplicate obligations", () => {
  assert.equal(compileVerificationContract({
    ...input,
    obligations: [{ ...input.obligations[0], verificationClasses: ["unknown"] }]
  })._tag, "Refusal");

  assert.equal(compileVerificationContract({
    ...input,
    obligations: [input.obligations[0], input.obligations[0]]
  })._tag, "Refusal");
});
