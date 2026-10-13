import assert from "node:assert/strict";
import test from "node:test";
import { runConformance } from "../src/conformance.js";

test("conformance isolates fixtures, captures exceptions, and leaves equivalence to the project", () => {
  const fixtures = [
    { id: "ok", input: { value: 1 }, expected: { kind: "accepted", value: 2 } },
    { id: "throws", input: { value: 2 }, expected: { kind: "accepted", value: 4 } }
  ] as const;

  const report = runConformance({
    fixtures,
    implementation(input: { readonly value: number }) {
      assert.equal(Object.isFrozen(input), true);
      if (input.value === 2) throw new TypeError("boom");
      return { kind: "accepted", value: input.value * 2 };
    },
    equivalent(expected, observed) {
      return observed.kind === "returned" &&
        JSON.stringify(expected) === JSON.stringify(observed.value);
    }
  });

  assert.equal(report.passed, false);
  assert.equal(report.failures.length, 1);
  assert.equal(report.failures[0]?.fixtureId, "throws");
  assert.equal(report.failures[0]?.observed.kind, "exception");
});
