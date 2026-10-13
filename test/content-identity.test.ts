import assert from "node:assert/strict";
import test from "node:test";
import { contentDigest } from "../src/content-identity.js";

test("content identity hashes exact UTF-8 bytes and byte arrays consistently", () => {
  const text = contentDigest("hello");
  const bytes = contentDigest(new TextEncoder().encode("hello"));
  assert.equal(text, bytes);
  assert.match(text, /^sha256:[0-9a-f]{64}$/);
});

test("content identity distinguishes byte-level changes", () => {
  assert.notEqual(contentDigest("hello\n"), contentDigest("hello"));
});
