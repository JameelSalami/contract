import assert from "node:assert/strict";
import test from "node:test";
import { canonicalDigest } from "../src/canonical.js";

test("canonical identity ignores object key order but preserves array order", () => {
  const left = canonicalDigest({ b: 2, a: { y: true, x: ["a", "b"] } });
  const right = canonicalDigest({ a: { x: ["a", "b"], y: true }, b: 2 });
  const reorderedArray = canonicalDigest({ a: { x: ["b", "a"], y: true }, b: 2 });
  assert.equal(left._tag, "Digest");
  assert.deepEqual(left, right);
  assert.notDeepEqual(left, reorderedArray);
});

test("canonical identity refuses values that cannot cross the JSON contract exactly", () => {
  assert.equal(canonicalDigest({ value: Number.MAX_SAFE_INTEGER + 1 })._tag, "Refusal");
  assert.equal(canonicalDigest({ value: undefined })._tag, "Refusal");
  assert.equal(canonicalDigest({ value: BigInt(1) })._tag, "Refusal");
});
