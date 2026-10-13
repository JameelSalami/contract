import assert from "node:assert/strict";
import test from "node:test";
import { projectDocuments } from "../src/document-adapter.js";

test("document adapters can project arbitrary project-local document kinds deterministically", () => {
  const result = projectDocuments({
    source: { ref: "semantic:model", digest: "sha256:" + "a".repeat(64) },
    adapter: {
      id: "software-docs",
      version: "1",
      render(input: { title: string }) {
        return [
          { ref: "doc:architecture", kind: "architecture", path: "generated/architecture.txt", mediaType: "text/plain", content: input.title + "\n" },
          { ref: "doc:custom", kind: "project-special", path: "generated/custom.json", mediaType: "application/json", content: "{\"title\":\"X\"}\n" }
        ];
      }
    },
    input: { title: "X" }
  });

  assert.equal(result._tag, "DocumentProjection");
  if (result._tag === "DocumentProjection") {
    assert.deepEqual(result.projection.files.map((x) => x.kind), ["architecture", "project-special"]);
    assert.equal(result.projection.files.every((x) => x.ownership === "generated"), true);
  }
});

test("document adapter refuses traversal paths", () => {
  const bad = projectDocuments({
    source: { ref: "x", digest: "sha256:" + "a".repeat(64) },
    adapter: {
      id: "bad",
      version: "1",
      render() {
        return [{ ref: "doc:x", kind: "x", path: "../escape.txt", mediaType: "text/plain", content: "x" }];
      }
    },
    input: null
  });
  assert.equal(bad._tag, "Refusal");
});


test("document projection sorting is independent of process locale", async () => {
  const { spawnSync } = await import("node:child_process");
  const code = [
    'import { projectDocuments } from "./src/document-adapter.ts";',
    'const value = projectDocuments({',
    '  source: { ref: "s", digest: "sha256:" + "a".repeat(64) },',
    '  adapter: { id: "deterministic", version: "1", render: () =>',
    '    ["ä", "z", "a"].map(path => ({ ref: path, path: path+".md",',
    '      kind: "doc", mediaType:"text/plain", content: "x" })) },',
    '  input: null',
    '});',
    'if (value._tag !== "DocumentProjection") throw Error(value.reason);',
    'process.stdout.write(JSON.stringify({ digest: value.projection.digest,',
    '  files: value.projection.files.map(file => file.path) }));',
  ].join("\n");
  const outputs: string[] = [];
  for (const locale of ["en_US.UTF-8", "sv_SE.UTF-8"]) {
    const child = spawnSync(process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", code],
      { cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
        env: { ...process.env, LANG: locale, LC_ALL: locale } });
    assert.equal(child.status, 0, child.stderr);
    outputs.push(child.stdout);
  }
  assert.equal(outputs[0], outputs[1]);
  assert.deepEqual(JSON.parse(outputs[0]!), {
    digest: JSON.parse(outputs[1]!).digest,
    files: ["a.md", "z.md", "ä.md"],
  });
});
