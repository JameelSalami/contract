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
