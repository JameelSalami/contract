import assert from "node:assert/strict";
import test from "node:test";
import { calculateChangeImpact } from "../src/dependency-impact.js";

test("change impact follows explicit edges only and terminates across cycles", () => {
  const result = calculateChangeImpact({
    nodes: ["semantic:a", "contract:a", "doc:a", "implementation:a", "unrelated"],
    edges: [
      { from: "semantic:a", to: "contract:a", relation: "defines" },
      { from: "contract:a", to: "doc:a", relation: "projects" },
      { from: "contract:a", to: "implementation:a", relation: "review-required" },
      { from: "doc:a", to: "contract:a", relation: "documents" }
    ],
    changedRefs: ["semantic:a"]
  });
  assert.equal(result._tag, "ChangeImpact");
  if (result._tag === "ChangeImpact") {
    assert.deepEqual(result.impact.affectedRefs, ["contract:a", "doc:a", "implementation:a"]);
    assert.equal(result.impact.affectedRefs.includes("unrelated"), false);
  }
});

test("project-local relation policy controls which explicit edges propagate impact", () => {
  const result = calculateChangeImpact({
    nodes: ["semantic:a", "projection:a", "artifact:a", "implementation:a"],
    edges: [
      { from: "semantic:a", to: "projection:a", relation: "defines-contract" },
      { from: "semantic:a", to: "artifact:a", relation: "affects" },
      { from: "semantic:a", to: "implementation:a", relation: "review-required" }
    ],
    changedRefs: ["semantic:a"],
    propagatingRelations: ["affects", "review-required"]
  });
  assert.equal(result._tag, "ChangeImpact");
  if (result._tag === "ChangeImpact") {
    assert.deepEqual(result.impact.affectedRefs, ["artifact:a", "implementation:a"]);
  }
});

test("change impact refuses undeclared references rather than guessing", () => {
  assert.equal(calculateChangeImpact({
    nodes: ["a"],
    edges: [{ from: "a", to: "missing", relation: "x" }],
    changedRefs: ["a"]
  })._tag, "Refusal");
});
