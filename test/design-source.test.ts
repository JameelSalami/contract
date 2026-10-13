import assert from "node:assert/strict";
import test from "node:test";
import { compileDesignSource } from "../src/design-source.js";

const source = `---
version: alpha
name: Portfolio
description: A restrained technical portfolio
colors:
  ink: "#1E1A14"
  accent: "#C3402A"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
spacing:
  sm: 8px
  md: 16px
rounded:
  surface: 4px
components:
  project-row:
    typography: "{typography.body}"
    padding: "{spacing.md}"
motion:
  feedback: 120ms
---

# Portfolio

## Overview

Technical/editorial, visual evidence rather than decoration.

## Motion

Transitions are mechanical and reduced motion preserves meaning.
`;

test("DESIGN.md adapter binds exact bytes, extracts concrete tokens, and preserves prose without inventing policy", () => {
  const result = compileDesignSource({
    kind: "design-md",
    path: "DESIGN.md",
    content: source
  });

  assert.equal(result._tag, "DesignSourceProjection");
  if (result._tag !== "DesignSourceProjection") return;

  assert.equal(result.projection.source.kind, "design-md");
  assert.equal(result.projection.source.path, "DESIGN.md");
  assert.match(result.projection.source.digest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.projection.name, "Portfolio");
  assert.equal(result.projection.tokens.colors.ink, "#1E1A14");
  assert.equal(result.projection.tokens.typography.body?.fontFamily, "Inter");
  assert.equal(result.projection.tokens.typography.body?.fontSize, "16px");
  assert.equal(result.projection.tokens.spacing.md, "16px");
  assert.equal(result.projection.tokens.rounded.surface, "4px");
  assert.deepEqual(result.projection.extensions.motion, { feedback: "120ms" });
  assert.deepEqual(result.projection.sections.map((section) => section.heading), ["Overview", "Motion"]);
  assert.match(result.projection.sections[0]?.body ?? "", /visual evidence/);
  assert.equal("acceptanceCriteria" in result.projection, false);
});

test("DESIGN.md byte changes change source identity while key order inside YAML remains source data", () => {
  const a = compileDesignSource({ kind: "design-md", path: "DESIGN.md", content: source });
  const b = compileDesignSource({ kind: "design-md", path: "DESIGN.md", content: source + "\n" });
  assert.equal(a._tag, "DesignSourceProjection");
  assert.equal(b._tag, "DesignSourceProjection");
  if (a._tag !== "DesignSourceProjection" || b._tag !== "DesignSourceProjection") return;
  assert.notEqual(a.projection.source.digest, b.projection.source.digest);
  assert.notEqual(a.projection.projectionDigest, b.projection.projectionDigest);
});

test("DESIGN.md adapter refuses duplicate sections, malformed frontmatter, and unsafe paths", () => {
  assert.equal(compileDesignSource({
    kind: "design-md",
    path: "DESIGN.md",
    content: "## Overview\nA\n\n## Overview\nB\n"
  })._tag, "Refusal");

  assert.equal(compileDesignSource({
    kind: "design-md",
    path: "DESIGN.md",
    content: "---\nname: [\n---\n## Overview\nX\n"
  })._tag, "Refusal");

  assert.equal(compileDesignSource({
    kind: "design-md",
    path: "../DESIGN.md",
    content: "## Overview\nX\n"
  })._tag, "Refusal");
});
