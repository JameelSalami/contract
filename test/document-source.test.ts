import assert from "node:assert/strict";
import test from "node:test";
import { compileDocumentBinding } from "../src/document-binding.js";
import { compileDocumentSource } from "../src/document-source.js";

test("standard repository documents retain exact source identity without a universal document taxonomy", () => {
  const kinds = [
    ["architecture", "ARCHITECTURE.md"],
    ["specification", "SPEC.md"],
    ["testing", "TESTING.md"],
    ["architecture-decision", "docs/adr/0001-example.md"],
    ["handoff", "HANDOFF.md"],
    ["product", "PRODUCT.md"],
    ["security", "SECURITY.md"],
  ] as const;

  for (const [kind, path] of kinds) {
    const result = compileDocumentSource({
      kind,
      path,
      mediaType: "text/markdown",
      ownership: "human",
      content: "# Title\n\n## Context\nBody\n",
    });
    assert.equal(result._tag, "DocumentSourceProjection", path);
    if (result._tag !== "DocumentSourceProjection") continue;
    assert.equal(result.projection.source.kind, kind);
    assert.equal(result.projection.source.path, path);
    assert.equal(result.projection.title, "Title");
    assert.deepEqual(result.projection.headings, [
      { level: 1, text: "Title" },
      { level: 2, text: "Context" },
    ]);
  }
});

test("document source identity changes with exact bytes and refuses traversal", () => {
  const a = compileDocumentSource({
    kind: "architecture",
    path: "ARCHITECTURE.md",
    mediaType: "text/markdown",
    ownership: "human",
    content: "# Architecture\n",
  });
  const b = compileDocumentSource({
    kind: "architecture",
    path: "ARCHITECTURE.md",
    mediaType: "text/markdown",
    ownership: "human",
    content: "# Architecture\n\n",
  });
  assert.equal(a._tag, "DocumentSourceProjection");
  assert.equal(b._tag, "DocumentSourceProjection");
  if (a._tag === "DocumentSourceProjection" && b._tag === "DocumentSourceProjection") {
    assert.notEqual(a.projection.source.digest, b.projection.source.digest);
    assert.notEqual(a.projection.projectionDigest, b.projection.projectionDigest);
  }

  assert.deepEqual(
    compileDocumentSource({
      kind: "architecture",
      path: "../ARCHITECTURE.md",
      mediaType: "text/markdown",
      ownership: "human",
      content: "# Architecture\n",
    }),
    { _tag: "Refusal", reason: "unsafe-document-source-path" },
  );
});

test("document bindings connect exact human sources to project-local targets without owning semantics", () => {
  const source = compileDocumentSource({
    kind: "testing",
    path: "TESTING.md",
    mediaType: "text/markdown",
    ownership: "human",
    content: "# Testing\n\n## Strategy\nIndependent falsifiers.\n",
  });
  assert.equal(source._tag, "DocumentSourceProjection");
  if (source._tag !== "DocumentSourceProjection") return;

  const result = compileDocumentBinding({
    id: "testing-to-verification",
    source: source.projection,
    bindingKind: "verification-guidance",
    targetRefs: ["assurance:project", "verification:software"],
    authority: "none",
  });
  assert.equal(result._tag, "DocumentBinding");
  if (result._tag === "DocumentBinding") {
    assert.equal(result.binding.sourceDigest, source.projection.source.digest);
    assert.equal(result.binding.sourceProjectionDigest, source.projection.projectionDigest);
    assert.deepEqual(result.binding.targetRefs, [
      "assurance:project",
      "verification:software",
    ]);
    assert.equal(result.binding.authority, "none");
  }

  assert.equal(
    compileDocumentBinding({
      id: "bad",
      source: source.projection,
      bindingKind: "x",
      targetRefs: ["x"],
      authority: "execute",
    })._tag,
    "Refusal",
  );
});
