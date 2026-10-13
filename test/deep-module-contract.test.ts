import assert from "node:assert/strict";
import test from "node:test";
import { compileDeepModuleContract } from "../src/deep-module-contract.js";

test("deep module contract closes a small public seam around coherent hidden complexity", () => {
  const result = compileDeepModuleContract({
    schema: "contract.deep-module/v1",
    module: "artifact-drift",
    source: "src/artifact-drift.ts",
    public: { exports: [{ name: "observeArtifactDrift", arity: 2 }] },
    encapsulated: ["manifest indexing", "missing and untracked classification", "read-only comparison"],
    guarantees: ["observation never repairs", "ownership survives drift projection"],
    depth: { maxPublicSymbols: 1, maxArgsPerExport: 2 },
    authority: "none"
  });
  assert.equal(result._tag, "DeepModuleContract");
});

test("deep module contract rejects surface budget violations, duplicates, and authority", () => {
  assert.equal(compileDeepModuleContract({
    schema: "contract.deep-module/v1",
    module: "x",
    public: { exports: [{ name: "a", arity: 1 }, { name: "b", arity: 1 }] },
    encapsulated: ["x"],
    guarantees: ["x"],
    depth: { maxPublicSymbols: 1, maxArgsPerExport: 1 },
    authority: "none"
  })._tag, "Refusal");

  assert.equal(compileDeepModuleContract({
    schema: "contract.deep-module/v1",
    module: "x",
    public: { exports: [{ name: "a", arity: 1 }, { name: "a", arity: 1 }] },
    encapsulated: ["x"],
    guarantees: ["x"],
    depth: { maxPublicSymbols: 2, maxArgsPerExport: 1 },
    authority: "none"
  })._tag, "Refusal");

  assert.equal(compileDeepModuleContract({
    schema: "contract.deep-module/v1",
    module: "x",
    public: { exports: [{ name: "a", arity: 1 }] },
    encapsulated: ["x"],
    guarantees: ["x"],
    depth: { maxPublicSymbols: 1, maxArgsPerExport: 1 },
    authority: "write"
  })._tag, "Refusal");
});
