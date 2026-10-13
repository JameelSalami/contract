import assert from "node:assert/strict";
import test from "node:test";
import { compileToolingContract, compileImplementationContract } from "../src/index.js";

const tooling = {
  schema: "contract.tooling/v1",
  id: "portable-javascript",
  runtimeFamily: "javascript",
  requiredCapabilities: ["esm", "utf8", "sha256-sync"],
  verification: "toolchain-conformance/v1",
  resolution: {
    preference: "user-installed-compatible",
    managedFallback: "consent-required",
    unsupported: "refuse",
  },
  authority: "none",
};

test("tooling contract is engine-version-agnostic and deterministically capability-bound", () => {
  const first = compileToolingContract(tooling);
  const reversed = compileToolingContract({
    ...tooling,
    requiredCapabilities: [...tooling.requiredCapabilities].reverse(),
  });
  assert.equal(first._tag, "ToolingContract");
  assert.equal(reversed._tag, "ToolingContract");
  if (first._tag !== "ToolingContract" || reversed._tag !== "ToolingContract") return;
  assert.deepEqual(first.contract.requiredCapabilities, ["esm", "sha256-sync", "utf8"]);
  assert.equal(first.contract.digest, reversed.contract.digest);
  assert.equal("nodeVersion" in first.contract, false);
  assert.equal(first.contract.resolution.managedFallback, "consent-required");
  assert.equal(first.contract.authority, "none");
});

test("tooling contract refuses missing capabilities, duplicates and implicit runtime installs", () => {
  for (const invalid of [
    { ...tooling, requiredCapabilities: [] },
    { ...tooling, requiredCapabilities: ["esm", "esm"] },
    { ...tooling, requiredCapabilities: ["host shell"] },
    { ...tooling, resolution: { ...tooling.resolution, managedFallback: "silent-install" } },
    { ...tooling, authority: "granted" },
    { ...tooling, nodeVersion: "22" },
  ]) {
    assert.equal(compileToolingContract(invalid)._tag, "Refusal");
  }
});

const implementation = {
  schema: "contract.implementation/v1",
  id: "state-runtime-store",
  interface: { id: "state/StateRuntimeStore", version: "1" },
  requiredCapabilities: [
    "atomic-commit", "generation-cas", "integrity-history", "portable-snapshot"
  ],
  selection: {
    mode: "explicit-binding",
    unavailable: "refuse",
    migration: "verified-export-import",
  },
  authority: "none",
};

test("implementation contract binds capabilities without privileging a storage technology", () => {
  const compiled = compileImplementationContract(implementation);
  assert.equal(compiled._tag, "ImplementationContract");
  if (compiled._tag !== "ImplementationContract") return;
  assert.equal(compiled.contract.interface.id, "state/StateRuntimeStore");
  assert.equal(compiled.contract.selection.migration, "verified-export-import");
  assert.equal("sqlite" in compiled.contract, false);
  assert.equal("postgres" in compiled.contract, false);
  const reverse = compileImplementationContract({
    ...implementation,
    requiredCapabilities: [...implementation.requiredCapabilities].reverse(),
  });
  assert.equal(reverse._tag, "ImplementationContract");
  if (reverse._tag !== "ImplementationContract") {
    return;
  }
  assert.equal(compiled.contract.digest, reverse.contract.digest);
});

test("implementation contract rejects implicit swaps, missing laws and accidental authority", () => {
  for (const invalid of [
    { ...implementation, requiredCapabilities: [] },
    { ...implementation, requiredCapabilities: ["generation-cas", "generation-cas"] },
    { ...implementation, selection: { ...implementation.selection, migration: "skip" } },
    { ...implementation, selection: { ...implementation.selection, unavailable: "fallback" } },
    { ...implementation, authority: "execute" },
    { ...implementation, sql: "SELECT 1" },
  ]) {
    assert.equal(compileImplementationContract(invalid)._tag, "Refusal");
  }
});
