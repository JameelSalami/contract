import assert from "node:assert/strict";
import test from "node:test";
import { compileDesignSource } from "../src/design-source.js";
import { compileDesignSourceBinding } from "../src/design-source-binding.js";
import { compileVerificationContract } from "../src/verification-contract.js";

test("design source binding connects human design intent to generic UI laws and project-local acceptance", () => {
  const source = compileDesignSource({
    kind: "design-md",
    path: "DESIGN.md",
    content: "---\nname: Product\ncolors:\n  accent: \"#C3402A\"\n---\n## Overview\nRestrained.\n"
  });
  assert.equal(source._tag, "DesignSourceProjection");
  if (source._tag !== "DesignSourceProjection") return;

  const binding = compileDesignSourceBinding({
    id: "portfolio-design",
    source: source.projection,
    humanProjectionContractRef: "human-projection-v1",
    uiCompositionContractRef: "ui-composition-v1",
    acceptanceContractRef: "verification:portfolio-design",
    authority: "none"
  });
  assert.equal(binding._tag, "DesignSourceBinding");
  if (binding._tag !== "DesignSourceBinding") return;

  assert.equal(binding.binding.sourceRef, "design:DESIGN.md");
  assert.equal(binding.binding.sourceDigest, source.projection.source.digest);
  assert.equal(binding.binding.sourceProjectionDigest, source.projection.projectionDigest);
  assert.equal(binding.binding.authority, "none");

  const verification = compileVerificationContract({
    schema: "contract.verification-contract/v1",
    id: "portfolio-design",
    subjectRefs: [binding.binding.id],
    evidenceClasses: [
      { id: "viewport-conformance", meaning: "bounded viewport check", stage: "post-code" },
      { id: "human-scenario", meaning: "human visual judgment", stage: "post-code" }
    ],
    obligations: [{
      id: "V-REDUCED-MOTION",
      statement: "Reduced motion preserves meaning",
      sourceRefs: [binding.binding.sourceRef, "ui-composition-v1#reduced-motion-preserves-meaning"],
      targetRefs: ["renderer:portfolio"],
      verificationClasses: ["viewport-conformance", "human-scenario"],
      required: true,
      stage: "post-code"
    }],
    authority: "none"
  });
  assert.equal(verification._tag, "VerificationContract");
});

test("design source binding refuses authority and malformed source identity", () => {
  assert.equal(compileDesignSourceBinding({
    id: "x",
    source: {
      schema: "contract.design-source-projection/v1",
      source: { ref: "design:DESIGN.md", kind: "design-md", path: "DESIGN.md", digest: "bad" },
      formatVersion: null,
      name: null,
      description: null,
      omitted: [],
      tokens: { colors: {}, typography: {}, spacing: {}, rounded: {}, components: {} },
      extensions: {},
      sections: [],
      projectionDigest: "sha256:" + "a".repeat(64)
    },
    humanProjectionContractRef: "human-projection-v1",
    uiCompositionContractRef: "ui-composition-v1",
    acceptanceContractRef: "verification:x",
    authority: "none"
  })._tag, "Refusal");

  const source = compileDesignSource({ kind: "design-md", path: "DESIGN.md", content: "## Overview\nX\n" });
  assert.equal(source._tag, "DesignSourceProjection");
  if (source._tag !== "DesignSourceProjection") return;
  assert.equal(compileDesignSourceBinding({
    id: "x",
    source: source.projection,
    humanProjectionContractRef: "human-projection-v1",
    uiCompositionContractRef: "ui-composition-v1",
    acceptanceContractRef: "verification:x",
    authority: "write"
  })._tag, "Refusal");
});
