import assert from "node:assert/strict";
import test from "node:test";
import { compileHumanProjectionContract } from "../src/human-projection-contract.js";

test("promoted human projection contract is generic, non-authoritative, and source-traceable", () => {
  const result = compileHumanProjectionContract();
  assert.equal(result._tag, "HumanProjectionContract");
  if (result._tag !== "HumanProjectionContract") return;

  assert.equal(result.contract.schema, "contract.human-projection/v1");
  assert.equal(result.contract.id, "human-projection-v1");
  assert.equal(result.contract.authority, "none");
  assert.equal("designRoot" in result.contract, false);
  assert.equal("project" in result.contract, false);
  assert.ok(result.contract.laws.some((law) => law.id === "human-unknown-remains-visible"));
  assert.ok(result.contract.laws.some((law) => law.id === "human-feedback-does-not-overclaim-outcome"));
});

test("human projection contract rejects authority, duplicate laws, and open-world fields", () => {
  const base = compileHumanProjectionContract();
  assert.equal(base._tag, "HumanProjectionContract");
  if (base._tag !== "HumanProjectionContract") return;

  assert.equal(compileHumanProjectionContract({ ...base.contract, authority: "write" })._tag, "Refusal");
  assert.equal(compileHumanProjectionContract({
    ...base.contract,
    laws: [base.contract.laws[0], base.contract.laws[0]]
  })._tag, "Refusal");
  assert.equal(compileHumanProjectionContract({ ...base.contract, renderer: "react" })._tag, "Refusal");
});
