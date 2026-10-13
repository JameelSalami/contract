import assert from "node:assert/strict";
import test from "node:test";
import { compileGuidanceBinding } from "../src/guidance-binding.js";
import { compileGuidanceSource } from "../src/guidance-source.js";

test("MDC guidance parses the legacy metadata convention used by repository rules", () => {
  const result = compileGuidanceSource({
    format: "mdc",
    path: "rules/01-security.mdc",
    content: [
      'description: "Workstation security rules and execution constraints"',
      'globs: "*"',
      "global: true",
      "required_tools: []",
      "---",
      "# Security",
      "No secrets in files.",
      "",
    ].join("\n"),
  });

  assert.equal(result._tag, "GuidanceSourceProjection");
  if (result._tag !== "GuidanceSourceProjection") return;
  assert.equal(result.projection.metadata.description, "Workstation security rules and execution constraints");
  assert.deepEqual(result.projection.metadata.globs, ["*"]);
  assert.equal(result.projection.metadata.global, true);
  assert.deepEqual(result.projection.metadata.requiredTools, []);
  assert.equal(result.projection.body.startsWith("# Security"), true);
});

test("MDC guidance parses frontmatter-first rules and preserves project-extensible metadata", () => {
  const result = compileGuidanceSource({
    format: "mdc",
    path: "rules/no-fluff.mdc",
    content: [
      "---",
      'description: "No filler"',
      'globs: "**/*"',
      "alwaysApply: false",
      'forbidden_phrases: ["one thing worth noting", "as an AI"]',
      "max_length: 20000",
      "---",
      "# No filler",
      "Be direct.",
      "",
    ].join("\n"),
  });

  assert.equal(result._tag, "GuidanceSourceProjection");
  if (result._tag !== "GuidanceSourceProjection") return;
  assert.equal(result.projection.metadata.alwaysApply, false);
  assert.deepEqual(result.projection.metadata.forbiddenPhrases, [
    "as an AI",
    "one thing worth noting",
  ]);
  assert.deepEqual(result.projection.metadata.extensions, { max_length: 20000 });
});

test("AGENTS, CLAUDE, steering and llms sources remain exact guidance without invented policy metadata", () => {
  for (const [format, path] of [
    ["agents-md", "AGENTS.md"],
    ["claude-md", "CLAUDE.md"],
    ["steering-md", ".kiro/steering/lean-ctx.md"],
    ["llms-txt", "llms.txt"],
  ] as const) {
    const result = compileGuidanceSource({
      format,
      path,
      content: "# Guidance\nRead project-local rules.\n",
    });
    assert.equal(result._tag, "GuidanceSourceProjection", path);
    if (result._tag !== "GuidanceSourceProjection") continue;
    assert.equal(result.projection.metadata.description, null);
    assert.deepEqual(result.projection.metadata.globs, []);
    assert.equal(result.projection.body, "# Guidance\nRead project-local rules.\n");
  }
});

test("guidance binding freezes exact delivered/indexed sources and target scope", () => {
  const security = compileGuidanceSource({
    format: "mdc",
    path: "rules/01-security.mdc",
    content: 'description: "Security"\nglobs: "*"\nglobal: true\n---\nNo secrets.\n',
  });
  const agents = compileGuidanceSource({
    format: "agents-md",
    path: "AGENTS.md",
    content: "# Agents\nProject instructions.\n",
  });
  assert.equal(security._tag, "GuidanceSourceProjection");
  assert.equal(agents._tag, "GuidanceSourceProjection");
  if (
    security._tag !== "GuidanceSourceProjection" ||
    agents._tag !== "GuidanceSourceProjection"
  ) return;

  const result = compileGuidanceBinding({
    id: "worker-guidance",
    sources: [agents.projection, security.projection],
    targetRefs: ["role:worker", "project:example"],
    mode: "required",
    delivery: "indexed",
    authority: "none",
  });
  assert.equal(result._tag, "GuidanceBinding");
  if (result._tag === "GuidanceBinding") {
    assert.deepEqual(result.binding.sources.map((item) => item.ref), [
      "guidance:AGENTS.md",
      "guidance:rules/01-security.mdc",
    ]);
    assert.deepEqual(result.binding.targetRefs, ["project:example", "role:worker"]);
    assert.equal(result.binding.mode, "required");
    assert.equal(result.binding.delivery, "indexed");
    assert.equal(result.binding.authority, "none");
  }

  const duplicate = compileGuidanceBinding({
    id: "bad",
    sources: [security.projection, security.projection],
    targetRefs: ["role:worker"],
    mode: "required",
    delivery: "inline",
    authority: "none",
  });
  assert.deepEqual(duplicate, { _tag: "Refusal", reason: "duplicate-guidance-source" });
});

test("invalid MDC frontmatter and unsafe guidance paths fail closed", () => {
  assert.deepEqual(
    compileGuidanceSource({
      format: "mdc",
      path: "rules/bad.mdc",
      content: "description: x\ndescription: y\n---\nbody\n",
    }),
    { _tag: "Refusal", reason: "invalid-guidance-frontmatter" },
  );
  assert.deepEqual(
    compileGuidanceSource({
      format: "agents-md",
      path: "../AGENTS.md",
      content: "x",
    }),
    { _tag: "Refusal", reason: "unsafe-guidance-source-path" },
  );
});
