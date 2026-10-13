import assert from "node:assert/strict";
import test from "node:test";
import { compileTestContract } from "../src/test-contract.js";

const D = (c: string): `sha256:${string}` =>
  ("sha256:" + c.repeat(64)) as `sha256:${string}`;

const input = {
  schema: "contract.test-contract/v1",
  id: "agent-calendar-create",
  revision: 1,
  subjectRefs: [
    { ref: "project:agent@4e31fb2", digest: D("1") }
  ],
  caseRefs: [
    { ref: "case:calendar-create", digest: D("2") }
  ],
  checkerRefs: [
    { ref: "checker:calendar-readback", digest: D("3") }
  ],
  fixtureRefs: [
    { ref: "fixture:calendar-fixture", digest: D("4") }
  ],
  environmentRefs: [
    { ref: "environment:local", digest: D("5") }
  ],
  execution: {
    repetitions: 1,
    timeoutMs: 30000,
    maxConcurrency: 1,
    effectMode: "declared-effects",
    allowedCapabilityRefs: ["calendar.create"]
  },
  acceptance: {
    requiredCheckRefs: ["calendar-readback"],
    blockerCheckRefs: ["calendar-readback"],
    unknownPolicy: "block"
  },
  evidence: {
    requiredEvidenceClasses: ["owner-observation", "trace"]
  },
  authority: "none"
} as const;

test("test contract freezes an exact protocol before execution", () => {
  const result = compileTestContract(input);
  assert.equal(result._tag, "TestContract");
  if (result._tag !== "TestContract") return;

  assert.equal(result.contract.authority, "none");
  assert.match(result.contract.digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(result.contract.execution.allowedCapabilityRefs, [
    "calendar.create"
  ]);
  assert.deepEqual(result.contract.acceptance.blockerCheckRefs, [
    "calendar-readback"
  ]);
  assert.equal(result.contract.acceptance.unknownPolicy, "block");
});

test("test contract identity changes when frozen protocol inputs change", () => {
  const base = compileTestContract(input);
  const changedFixture = compileTestContract({
    ...input,
    fixtureRefs: [{ ref: "fixture:calendar-fixture", digest: D("9") }]
  });
  const changedChecker = compileTestContract({
    ...input,
    checkerRefs: [{ ref: "checker:calendar-readback", digest: D("a") }]
  });
  const changedPolicy = compileTestContract({
    ...input,
    acceptance: { ...input.acceptance, unknownPolicy: "fail" }
  });
  assert.equal(base._tag, "TestContract");
  assert.equal(changedFixture._tag, "TestContract");
  assert.equal(changedChecker._tag, "TestContract");
  assert.equal(changedPolicy._tag, "TestContract");
  if (
    base._tag !== "TestContract" ||
    changedFixture._tag !== "TestContract" ||
    changedChecker._tag !== "TestContract" ||
    changedPolicy._tag !== "TestContract"
  ) return;
  assert.notEqual(base.contract.digest, changedFixture.contract.digest);
  assert.notEqual(base.contract.digest, changedChecker.contract.digest);
  assert.notEqual(base.contract.digest, changedPolicy.contract.digest);
});

test("read-only test contracts cannot declare effect capabilities", () => {
  const result = compileTestContract({
    ...input,
    execution: {
      ...input.execution,
      effectMode: "read-only",
      allowedCapabilityRefs: ["calendar.create"]
    }
  });
  assert.deepEqual(result, {
    _tag: "Refusal",
    reason: "read-only-capability-conflict"
  });
});

test("declared-effect contracts require explicit capabilities", () => {
  const result = compileTestContract({
    ...input,
    execution: {
      ...input.execution,
      effectMode: "declared-effects",
      allowedCapabilityRefs: []
    }
  });
  assert.deepEqual(result, {
    _tag: "Refusal",
    reason: "declared-effects-without-capability"
  });
});

test("blockers must be required checks and open input fails closed", () => {
  assert.deepEqual(
    compileTestContract({
      ...input,
      acceptance: {
        ...input.acceptance,
        blockerCheckRefs: ["undeclared"]
      }
    }),
    {
      _tag: "Refusal",
      reason: "undeclared-blocker-check"
    }
  );

  assert.equal(
    compileTestContract({ ...input, surprise: true })._tag,
    "Refusal"
  );
});

test("reference identity conflicts and duplicates are refused", () => {
  assert.deepEqual(
    compileTestContract({
      ...input,
      caseRefs: [
        { ref: "case:calendar-create", digest: D("2") },
        { ref: "case:calendar-create", digest: D("9") }
      ]
    }),
    {
      _tag: "Refusal",
      reason: "duplicate-reference"
    }
  );

  assert.deepEqual(
    compileTestContract({
      ...input,
      acceptance: {
        ...input.acceptance,
        requiredCheckRefs: ["calendar-readback", "calendar-readback"]
      }
    }),
    {
      _tag: "Refusal",
      reason: "duplicate-check-ref"
    }
  );
});
