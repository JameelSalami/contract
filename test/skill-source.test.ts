import assert from "node:assert/strict";
import test from "node:test";
import { compileSkillBinding } from "../src/skill-binding.js";
import { compileSkillSource } from "../src/skill-source.js";

const source = () => compileSkillSource({
  root: "skills/github-index",
  entrypoint: "SKILL.md",
  files: [
    {
      path: "SKILL.md",
      kind: "instruction",
      mediaType: "text/markdown",
      content: [
        "---",
        "name: github-index",
        "description: Deterministic lookup across curated references.",
        "license: MIT",
        "required_tools: [bash]",
        "capabilities: [repository-read]",
        "custom_flag: retained",
        "---",
        "# GitHub Index Skill",
        "Use the bundled script.",
        "",
      ].join("\n"),
    },
    {
      path: "scripts/gh-index.sh",
      kind: "script",
      mediaType: "text/x-shellscript",
      content: "#!/bin/sh\necho lookup\n",
    },
    {
      path: "references/quality.md",
      kind: "reference",
      mediaType: "text/markdown",
      content: "# Quality\nVerify links before recommending them.\n",
    },
  ],
});

test("skill source content-addresses the declared multi-file closure and SKILL metadata", () => {
  const result = source();
  assert.equal(result._tag, "SkillSourceProjection");
  if (result._tag !== "SkillSourceProjection") return;

  assert.equal(result.projection.source.ref, "skill:github-index");
  assert.equal(result.projection.source.entrypoint, "SKILL.md");
  assert.match(result.projection.source.entrypointDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(result.projection.source.closureDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(result.projection.metadata.requiredTools, ["bash"]);
  assert.deepEqual(result.projection.metadata.capabilities, ["repository-read"]);
  assert.deepEqual(result.projection.metadata.extensions, { custom_flag: "retained" });
  assert.deepEqual(result.projection.files.map((file) => file.path), [
    "SKILL.md",
    "references/quality.md",
    "scripts/gh-index.sh",
  ]);
});

test("skill closure identity changes when any declared file bytes change", () => {
  const a = source();
  const b = compileSkillSource({
    root: "skills/github-index",
    entrypoint: "SKILL.md",
    files: [
      {
        path: "SKILL.md",
        kind: "instruction",
        mediaType: "text/markdown",
        content: [
          "---",
          "name: github-index",
          "description: Deterministic lookup across curated references.",
          "license: MIT",
          "required_tools: [bash]",
          "capabilities: [repository-read]",
          "custom_flag: retained",
          "---",
          "# GitHub Index Skill",
          "Use the bundled script.",
          "",
        ].join("\n"),
      },
      {
        path: "scripts/gh-index.sh",
        kind: "script",
        mediaType: "text/x-shellscript",
        content: "#!/bin/sh\necho changed\n",
      },
      {
        path: "references/quality.md",
        kind: "reference",
        mediaType: "text/markdown",
        content: "# Quality\nVerify links before recommending them.\n",
      },
    ],
  });
  assert.equal(a._tag, "SkillSourceProjection");
  assert.equal(b._tag, "SkillSourceProjection");
  if (a._tag === "SkillSourceProjection" && b._tag === "SkillSourceProjection") {
    assert.notEqual(a.projection.source.closureDigest, b.projection.source.closureDigest);
    assert.notEqual(a.projection.projectionDigest, b.projection.projectionDigest);
  }
});

test("skill binding admits the exact skill closure without granting capabilities", () => {
  const compiled = source();
  assert.equal(compiled._tag, "SkillSourceProjection");
  if (compiled._tag !== "SkillSourceProjection") return;

  const result = compileSkillBinding({
    id: "worker-github-index",
    source: compiled.projection,
    targetRefs: ["role:worker", "task:research"],
    mode: "selected",
    capabilityRefs: ["capability:repository-read"],
    authority: "none",
  });
  assert.equal(result._tag, "SkillBinding");
  if (result._tag === "SkillBinding") {
    assert.equal(result.binding.sourceRef, "skill:github-index");
    assert.equal(result.binding.sourceClosureDigest, compiled.projection.source.closureDigest);
    assert.equal(result.binding.entrypoint, "SKILL.md");
    assert.deepEqual(result.binding.capabilityRefs, ["capability:repository-read"]);
    assert.equal(result.binding.authority, "none");
  }
});

test("skill binding derives entrypoint from the admitted closure and rejects malformed projections", () => {
  const compiled = source();
  assert.equal(compiled._tag, "SkillSourceProjection");
  if (compiled._tag !== "SkillSourceProjection") return;

  const result = compileSkillBinding({
    id: "required-skill",
    source: compiled.projection,
    targetRefs: ["role:worker"],
    mode: "required",
    capabilityRefs: [],
    authority: "none",
  });
  assert.equal(result._tag, "SkillBinding");
  if (result._tag === "SkillBinding") {
    assert.equal(result.binding.entrypoint, compiled.projection.source.entrypoint);
    assert.equal(result.binding.sourceClosureDigest, compiled.projection.source.closureDigest);
  }

  assert.equal(
    compileSkillBinding({
      id: "bad-source",
      source: { ...compiled.projection, files: [] },
      targetRefs: ["role:worker"],
      mode: "required",
      capabilityRefs: [],
      authority: "none",
    })._tag,
    "Refusal",
  );
});

test("skill source refuses unsafe paths, duplicate files, and malformed SKILL frontmatter", () => {
  assert.equal(
    compileSkillSource({
      root: "../skills/x",
      entrypoint: "SKILL.md",
      files: [{ path: "SKILL.md", kind: "instruction", mediaType: "text/markdown", content: "---\nname: x\ndescription: x\n---\n" }],
    })._tag,
    "Refusal",
  );

  assert.deepEqual(
    compileSkillSource({
      root: "skills/x",
      entrypoint: "SKILL.md",
      files: [
        { path: "SKILL.md", kind: "instruction", mediaType: "text/markdown", content: "---\nname: x\ndescription: x\n---\n" },
        { path: "SKILL.md", kind: "reference", mediaType: "text/markdown", content: "duplicate" },
      ],
    }),
    { _tag: "Refusal", reason: "duplicate-skill-file" },
  );

  assert.deepEqual(
    compileSkillSource({
      root: "skills/x",
      entrypoint: "SKILL.md",
      files: [{ path: "SKILL.md", kind: "instruction", mediaType: "text/markdown", content: "# No frontmatter\n" }],
    }),
    { _tag: "Refusal", reason: "invalid-skill-frontmatter" },
  );
});