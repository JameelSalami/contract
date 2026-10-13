import assert from "node:assert/strict";
import test from "node:test";
import { compileArtifactManifest } from "../src/artifact-manifest.js";
import { observeArtifactDrift } from "../src/artifact-drift.js";

const digest = (c: string) => "sha256:" + c.repeat(64);

test("drift observation is read-only and keeps missing, mismatched and untracked explicit", () => {
  const compiled = compileArtifactManifest({
    projectId: "p",
    artifacts: [
      { ref: "generated:a", kind: "contract", path: "generated/a.json", ownership: "generated", digest: digest("a"), sourceRefs: ["source:a"], generator: { id: "g", version: "1" } },
      { ref: "human:b", kind: "architecture", path: "ARCHITECTURE.md", ownership: "human", digest: digest("b"), sourceRefs: [] },
      { ref: "generated:c", kind: "test-fixtures", path: "generated/c.json", ownership: "generated", digest: digest("c"), sourceRefs: ["source:c"], generator: { id: "g", version: "1" } }
    ]
  });
  assert.equal(compiled._tag, "ArtifactManifest");
  if (compiled._tag !== "ArtifactManifest") return;

  const observed = [
    { path: "generated/a.json", digest: digest("x") },
    { path: "ARCHITECTURE.md", digest: digest("b") },
    { path: "scratch.txt", digest: digest("s") }
  ];
  const before = structuredClone(observed);
  const result = observeArtifactDrift(compiled.manifest, observed);
  assert.deepEqual(observed, before);
  assert.deepEqual(result.entries.map((x) => [x.path, x.status]), [
    ["ARCHITECTURE.md", "current"],
    ["generated/a.json", "content-mismatch"],
    ["generated/c.json", "missing"],
    ["scratch.txt", "untracked"]
  ]);
});
