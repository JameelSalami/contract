import assert from "node:assert/strict";
import test from "node:test";
import { compileArtifactManifest } from "../src/artifact-manifest.js";

const digest = (c: string) => "sha256:" + c.repeat(64);

test("artifact manifest supports generated and human software documents without owning their semantics", () => {
  const result = compileArtifactManifest({
    projectId: "forge",
    artifacts: [
      {
        ref: "doc:architecture",
        kind: "architecture",
        path: "ARCHITECTURE.md",
        ownership: "human",
        digest: digest("a"),
        sourceRefs: ["contract:runtime"]
      },
      {
        ref: "doc:api",
        kind: "api-interface",
        path: "generated/api.json",
        ownership: "generated",
        digest: digest("b"),
        sourceRefs: ["contract:api"],
        generator: { id: "api-projector", version: "1" }
      },
      {
        ref: "doc:local",
        kind: "project-special-document",
        path: "design/local.txt",
        ownership: "human",
        digest: digest("c"),
        sourceRefs: []
      }
    ]
  });
  assert.equal(result._tag, "ArtifactManifest");
});

test("artifact manifest fails closed on unsafe paths, duplicates, and source-less generated artifacts", () => {
  assert.equal(compileArtifactManifest({
    projectId: "x",
    artifacts: [{
      ref: "a", kind: "contract", path: "../escape.json", ownership: "generated",
      digest: digest("a"), sourceRefs: ["source:x"], generator: { id: "g", version: "1" }
    }]
  })._tag, "Refusal");

  assert.equal(compileArtifactManifest({
    projectId: "x",
    artifacts: [
      { ref: "a", kind: "architecture", path: "A.txt", ownership: "human", digest: digest("a"), sourceRefs: [] },
      { ref: "a", kind: "design", path: "B.txt", ownership: "human", digest: digest("b"), sourceRefs: [] }
    ]
  })._tag, "Refusal");

  assert.equal(compileArtifactManifest({
    projectId: "x",
    artifacts: [{
      ref: "a", kind: "contract", path: "a.json", ownership: "generated",
      digest: digest("a"), sourceRefs: [], generator: { id: "g", version: "1" }
    }]
  })._tag, "Refusal");
});
