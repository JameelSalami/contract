import assert from "node:assert/strict";
import test from "node:test";
import { compileEngineeringDoctrineContract } from "../src/engineering-doctrine-contract.js";

test("promoted engineering doctrine is a closed domain-neutral contract", () => {
  const result = compileEngineeringDoctrineContract();
  assert.equal(result._tag, "EngineeringDoctrineContract");
  if (result._tag !== "EngineeringDoctrineContract") return;
  assert.equal(result.contract.authority, "none");
  assert.equal(result.contract.complexity.measure, "consumer-concepts");
  assert.equal(result.contract.ownership.oneSemanticOwner, true);
  assert.ok(result.contract.rules.some((rule) => rule.id === "falsifier-required"));
});

test("engineering doctrine rejects authority and unknown fields", () => {
  const base = compileEngineeringDoctrineContract();
  assert.equal(base._tag, "EngineeringDoctrineContract");
  if (base._tag !== "EngineeringDoctrineContract") return;

  assert.equal(compileEngineeringDoctrineContract({
    ...base.contract,
    authority: "binding"
  })._tag, "Refusal");

  assert.equal(compileEngineeringDoctrineContract({
    ...base.contract,
    surprise: true
  })._tag, "Refusal");
});
