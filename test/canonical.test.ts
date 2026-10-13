import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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


// These are independently constructed SHA-256 fixtures, not values generated
// from the implementation's own canonicalJson function.
const expectedHash = (canonicalJson: string): string =>
  "sha256:" + createHash("sha256").update(canonicalJson).digest("hex");

test("canonical identity uses locale-independent UTF-16 property order", () => {
  const value = { "ä": 2, z: 1, a: 3 };
  const expected = expectedHash('{"a":3,"z":1,"ä":2}');
  assert.deepEqual(canonicalDigest(value), { _tag: "Digest", digest: expected });
  assert.deepEqual(canonicalDigest({ a: 3, "ä": 2, z: 1 }), { _tag: "Digest", digest: expected });

  // High Unicode and supplementary-plane keys are sorted by UTF-16 code units.
  const supplementary = JSON.parse('{"\uE000":1,"\uD800\uDC00":2}') as Record<string, number>;
  const expectedSupplementary = '{"𐀀":2,"":1}';
  assert.deepEqual(canonicalDigest(supplementary), {
    _tag: "Digest",
    digest: expectedHash(expectedSupplementary),
  });
});

test("canonical identity writes numeric-looking and __proto__ keys in lexical order", () => {
  const value = JSON.parse('{"10":"ten","2":"two","01":"leading","__proto__":"literal"}');
  const canonical = '{"01":"leading","10":"ten","2":"two","__proto__":"literal"}';
  assert.deepEqual(canonicalDigest(value), {
    _tag: "Digest",
    digest: expectedHash(canonical),
  });
  assert.notEqual(canonicalDigest(value)._tag, "Refusal");

  const nested = { z: [{ "10": "ten", "2": "two" }], a: 4 };
  const expectedNested = '{"a":4,"z":[{"10":"ten","2":"two"}]}';
  assert.deepEqual(canonicalDigest(nested), {
    _tag: "Digest",
    digest: expectedHash(expectedNested),
  });
});

test("canonical digest is identical across English and Swedish process locales", () => {
  const javascript = [
    'import { canonicalDigest } from "./src/canonical.ts";',
    'const value = { z: { "10": "ten", "2": "two" }, "ä": 2, a: 3 };',
    'process.stdout.write(JSON.stringify(canonicalDigest(value)));',
  ].join("\n");
  const results: string[] = [];
  for (const locale of ["en_US.UTF-8", "sv_SE.UTF-8"]) {
    const run = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", javascript],
      { cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
        env: { ...process.env, LANG: locale, LC_ALL: locale } },
    );
    assert.equal(run.status, 0, run.stderr);
    results.push(run.stdout);
  }
  assert.equal(results[0], results[1]);
  assert.equal(results[0], JSON.stringify({
    _tag: "Digest",
    digest: expectedHash('{"a":3,"z":{"10":"ten","2":"two"},"ä":2}'),
  }));
});
