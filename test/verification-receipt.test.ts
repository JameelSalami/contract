import assert from "node:assert/strict";
import test from "node:test";
import { compileVerificationReceipt } from "../src/verification-receipt.js";

test("verification receipt binds subject, checker, evidence and falsifiers", () => {
  const result = compileVerificationReceipt({
    subject: { ref: "implementation:x", digest: "sha256:" + "a".repeat(64) },
    checker: { id: "conformance", version: "1" },
    outcome: "failed",
    evidenceRefs: ["fixture:b", "fixture:a"],
    caseRefs: ["falsifier:1"],
    summary: "one semantic law diverged"
  });
  assert.equal(result._tag, "VerificationReceipt");
  if (result._tag === "VerificationReceipt") {
    assert.deepEqual(result.receipt.evidenceRefs, ["fixture:a", "fixture:b"]);
    assert.equal("executable" in result.receipt, false);
  }
});
