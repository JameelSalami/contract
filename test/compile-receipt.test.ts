import assert from "node:assert/strict";
import test from "node:test";
import { compileReceipt } from "../src/compile-receipt.js";

const sources = [
  { ref: "source:b", digest: "sha256:" + "b".repeat(64) },
  { ref: "source:a", digest: "sha256:" + "a".repeat(64) }
];

test("compile receipt binds exact sources and normalizes deterministically", () => {
  const input = {
    compiler: { id: "employee-semantic", version: "2" },
    sources,
    outcome: {
      kind: "verified",
      resultRef: "semantic:model",
      resultDigest: "sha256:" + "c".repeat(64)
    }
  };
  const a = compileReceipt(input);
  const b = compileReceipt({ ...input, sources: [...sources].reverse() });
  assert.equal(a._tag, "CompileReceipt");
  assert.deepEqual(a, b);
  if (a._tag === "CompileReceipt") {
    assert.deepEqual(a.receipt.sources.map((x) => x.ref), ["source:a", "source:b"]);
  }
});

test("compile receipt refuses duplicate source refs and malformed outcomes", () => {
  assert.equal(compileReceipt({
    compiler: { id: "x", version: "1" },
    sources: [sources[0], sources[0]],
    outcome: { kind: "refused", code: "bad-input" }
  })._tag, "Refusal");

  assert.equal(compileReceipt({
    compiler: { id: "x", version: "1" },
    sources: [sources[0]],
    outcome: { kind: "verified", resultRef: "x" }
  })._tag, "Refusal");
});
