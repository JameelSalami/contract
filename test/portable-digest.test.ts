import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalDigest, contentDigest } from "../src/index.js";

const golden = JSON.parse(readFileSync(new URL("./portability-digests.v1.json", import.meta.url), "utf8"));

test("Contract v1 preserves byte-identical canonical identity after JS-portable hash change", () => {
  for (const vector of golden.json) {
    assert.deepEqual(canonicalDigest(vector.value), vector.contract, vector.name);
  }
});

test("Contract content digests agree with frozen Node SHA-256 for UTF-8 and binary inputs", () => {
  for (const vector of golden.text) {
    assert.equal(contentDigest(vector.value), vector.expectedNodeCrypto);
    assert.equal(contentDigest(vector.value), vector.contract);
  }
  for (const vector of golden.bytes) {
    assert.equal(contentDigest(Uint8Array.from(vector.data)), vector.contract);
  }
});
