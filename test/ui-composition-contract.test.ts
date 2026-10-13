import assert from "node:assert/strict";
import test from "node:test";
import { compileUiCompositionContract } from "../src/ui-composition-contract.js";

test("promoted UI composition contract owns the renderer-independent closed grammar", () => {
  const result = compileUiCompositionContract();
  assert.equal(result._tag, "UiCompositionContract");
  if (result._tag !== "UiCompositionContract") return;

  assert.equal(result.contract.schema, "contract.ui-composition/v1");
  assert.equal(result.contract.humanProjectionContractRef, "human-projection-v1");
  assert.equal(result.contract.authority, "none");
  assert.deepEqual(result.contract.vocabulary.layoutPrimitives, [
    "stack", "inline", "grid", "split", "pane", "overlay", "dock", "canvas"
  ]);
  assert.deepEqual(result.contract.vocabulary.layerRoles, [
    "base", "raised", "sticky", "overlay", "popover", "modal", "toast", "drag", "system"
  ]);
  assert.equal(result.contract.fallbackProjection, "inspector");
  assert.ok(result.contract.laws.some((law) => law.id === "planner-selects-semantics-not-pixels"));
  assert.ok(result.contract.laws.some((law) => law.id === "reduced-motion-preserves-meaning"));
});

test("UI composition contract rejects renderer/raw-value escape hatches and vocabulary drift", () => {
  const base = compileUiCompositionContract();
  assert.equal(base._tag, "UiCompositionContract");
  if (base._tag !== "UiCompositionContract") return;

  assert.equal(compileUiCompositionContract({ ...base.contract, renderer: "react" })._tag, "Refusal");
  assert.equal(compileUiCompositionContract({ ...base.contract, zIndex: 999 })._tag, "Refusal");
  assert.equal(compileUiCompositionContract({
    ...base.contract,
    vocabulary: {
      ...base.contract.vocabulary,
      layoutPrimitives: [...base.contract.vocabulary.layoutPrimitives, "absolute"]
    }
  })._tag, "Refusal");
});
