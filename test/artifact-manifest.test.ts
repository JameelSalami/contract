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


test("artifact manifest locale-independent array sorting is stable across hosts", async () => {
  const { spawnSync } = await import("node:child_process");
  const script = [
    'import { compileArtifactManifest } from "./src/artifact-manifest.ts";',
    'const digest = (c) => "sha256:" + c.repeat(64);',
    'const refs = ["a", "z", "ä"];',
    'const x = compileArtifactManifest({projectId:"p",artifacts:refs.map((ref)=>({',
    '  ref, kind:"doc",path:ref+".md",ownership:"human",',
    '  digest:digest("a"),sourceRefs:["z","ä","a"]',
    '}))});',
    'if (x._tag !== "ArtifactManifest") throw Error(x.reason);',
    'process.stdout.write(JSON.stringify(x.manifest));',
  ].join("\n");
  const outputs: string[] = [];
  for (const locale of ["en_US.UTF-8", "sv_SE.UTF-8"]) {
    const result = spawnSync(process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
        env: { ...process.env, LANG: locale, LC_ALL: locale } });
    assert.equal(result.status, 0, result.stderr);
    outputs.push(result.stdout);
  }
  assert.equal(outputs[0], outputs[1]);
  assert.deepEqual(JSON.parse(outputs[0]!).artifacts.map((x: { ref: string }) => x.ref), ["a", "z", "ä"]);
});
