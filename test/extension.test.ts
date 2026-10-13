import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalDigest,
  compileExtensionManifest,
  discoverExtensions,
  compileExtensionBinding,
  compileExtensionTransition,
  type ExtensionManifest,
  type ExtensionBinding,
} from "../src/index.js";

const sha = (value: unknown): string => {
  const result = canonicalDigest(value);
  if (result._tag !== "Digest") throw Error("invalid test digest");
  return result.digest;
};

const definition = {
  schema: "contract.extension-manifest/v1",
  id: "example.storage",
  version: "1.2.0",
  foundation: "state",
  interface: { id: "state/StateRuntimeStore", version: "v1" },
  capabilities: ["atomic-commit", "verified-history", "portable-snapshot"],
  requiredChecks: ["atomic-restart", "cas-conflict", "snapshot-roundtrip"],
  configurationSchemaDigest: sha({ schema: "example.storage/config-v1" }),
  authority: "none",
} as const;

function manifest(): ExtensionManifest {
  const compiled = compileExtensionManifest(definition);
  if (compiled._tag !== "ExtensionManifest") throw Error(compiled.reason);
  return compiled.manifest;
}

function binding(): ExtensionBinding {
  const extension = manifest();
  const compiled = compileExtensionBinding({
    schema: "contract.extension-binding/v1",
    projectId: "test-project",
    extensionId: extension.id,
    extensionVersion: extension.version,
    manifestDigest: extension.digest,
    configurationDigest: sha({ schema: "config/v1", profile: "local" }),
    qualificationDigest: sha({ externalReceipt: "qualification-1" }),
    authority: "none",
  }, extension);
  if (compiled._tag !== "ExtensionBinding") throw Error(compiled.reason);
  return compiled.binding;
}

test("discovery is deterministic, ordered and does not execute a contributed module", () => {
  const first = manifest();
  const reversed = compileExtensionManifest({
    ...definition,
    capabilities: [...definition.capabilities].reverse(),
    requiredChecks: [...definition.requiredChecks].reverse(),
  });
  assert.equal(reversed._tag, "ExtensionManifest");
  if (reversed._tag !== "ExtensionManifest") return;
  assert.equal(first.digest, reversed.manifest.digest);

  const second = compileExtensionManifest({ ...definition, id: "alternate.storage", version: "2.0.0" });
  assert.equal(second._tag, "ExtensionManifest");
  if (second._tag !== "ExtensionManifest") return;
  const query = {
    foundation: "state", interface: definition.interface,
    requiredCapabilities: ["atomic-commit", "verified-history"],
  };
  const found = discoverExtensions([first, second.manifest], query);
  assert.equal(found._tag, "ExtensionDiscovery");
  if (found._tag !== "ExtensionDiscovery") return;
  assert.deepEqual(found.manifests.map((item) => item.id), ["alternate.storage", "example.storage"]);
  assert.ok(found.manifests.every((item) => item.authority === "none"));
  assert.deepEqual(discoverExtensions([second.manifest, first], query), found);
  const missing = discoverExtensions([first], {
    ...query, requiredCapabilities: ["unproven-storage-law"]
  });
  assert.equal(missing._tag, "ExtensionDiscovery");
  if (missing._tag === "ExtensionDiscovery") assert.equal(missing.manifests.length, 0);
});

test("manifest refuses imperative fields, privilege claims, bad versions and duplicate obligations", () => {
  for (const value of [
    { ...definition, authority: "owner" },
    { ...definition, installScript: "rm -rf /" },
    { ...definition, version: "latest" },
    { ...definition, capabilities: ["atomic-commit", "atomic-commit"] },
    { ...definition, requiredChecks: [] },
    { ...definition, requiredChecks: ["cas-conflict", "cas-conflict"] },
    { ...definition, capabilities: ["unsafe command"] },
    { ...definition, configurationSchemaDigest: "sha256:bad" },
  ]) assert.equal(compileExtensionManifest(value)._tag, "Refusal");

  const current = manifest();
  assert.equal(discoverExtensions([current, current], {
    foundation: "state",
    interface: current.interface,
    requiredCapabilities: [],
  })._tag, "Refusal");
  assert.equal(discoverExtensions([{ ...current, capabilities: ["forged"] }], {
    foundation: "state", interface: current.interface,
    requiredCapabilities: [],
  })._tag, "Refusal");
});

test("binding is an immutable candidate bound to the exact verified manifest identity", () => {
  const known = manifest();
  const selected = binding();
  assert.equal(selected.manifestDigest, known.digest);
  assert.equal(selected.authority, "none");
  assert.match(selected.digest, /^sha256:[0-9a-f]{64}$/);

  const { digest, ...source } = selected;
  const repeat = compileExtensionBinding(source, known);
  assert.equal(repeat._tag, "ExtensionBinding");
  if (repeat._tag === "ExtensionBinding") assert.equal(repeat.binding.digest, digest);

  assert.equal(compileExtensionBinding({ ...source, manifestDigest: sha("fake") }, known)._tag, "Refusal");
  assert.equal(compileExtensionBinding({ ...source, extensionVersion: "1.0.0" }, known)._tag, "Refusal");
  assert.equal(compileExtensionBinding({ ...source, executable: true }, known)._tag, "Refusal");
  assert.equal(compileExtensionBinding({ ...source, qualificationDigest: "none" }, known)._tag, "Refusal");
  assert.equal(compileExtensionBinding(source, { ...known, digest: sha("counterfeit") })._tag, "Refusal");
});

test("transitions remain proposed effects with explicit qualification and authorization references", () => {
  const installed = binding();
  const base = {
    schema: "contract.extension-transition/v1",
    projectId: installed.projectId,
    operation: "replace",
    previousBindingDigest: installed.digest,
    nextBindingDigest: sha("new implementation binding"),
    effect: "data-migration",
    qualificationEvidenceDigest: sha("conformance report"),
    authorizationEvidenceDigest: sha("external human approval reference"),
    recoveryEvidenceDigest: sha("rollback snapshot"),
    migrationEvidenceDigest: sha("migration comparison"),
    requestedBy: { kind: "agent", id: "user-agent" },
    authority: "none",
  };
  const candidate = compileExtensionTransition(base);
  assert.equal(candidate._tag, "ExtensionTransition");
  if (candidate._tag !== "ExtensionTransition") return;
  assert.equal(candidate.transition.authority, "none");
  assert.equal(candidate.transition.requestedBy.kind, "agent");
  assert.equal("execute" in candidate.transition, false);
  assert.equal("approved" in candidate.transition, false);

  for (const value of [
    { ...base, authorizationEvidenceDigest: "not-a-digest" },
    { ...base, qualificationEvidenceDigest: null },
    { ...base, migrationEvidenceDigest: null },
    { ...base, recoveryEvidenceDigest: null },
    { ...base, previousBindingDigest: base.nextBindingDigest },
    { ...base, operation: "install" },
    { ...base, operation: "remove" },
    { ...base, requestedBy: { ...base.requestedBy, kind: "system" } },
    { ...base, authority: "execute" },
    { ...base, executableCommand: "unsafe" },
  ]) assert.equal(compileExtensionTransition(value)._tag, "Refusal");
});

test("installation and removal cannot be confused with upgrades or skip rollback", () => {
  const known = binding();
  const common = {
    schema: "contract.extension-transition/v1",
    projectId: "test-project",
    operation: "install",
    previousBindingDigest: null,
    nextBindingDigest: known.digest,
    effect: "configuration-only",
    qualificationEvidenceDigest: sha("qualifier"),
    authorizationEvidenceDigest: sha("authorization"),
    recoveryEvidenceDigest: null,
    migrationEvidenceDigest: null,
    requestedBy: { kind: "human", id: "owner" },
    authority: "none",
  };
  assert.equal(compileExtensionTransition(common)._tag, "ExtensionTransition");
  const removal = {
    ...common,
    operation: "remove",
    previousBindingDigest: known.digest,
    nextBindingDigest: null,
    recoveryEvidenceDigest: sha("recover"),
  };
  assert.equal(compileExtensionTransition(removal)._tag, "ExtensionTransition");
  assert.equal(compileExtensionTransition({ ...removal, recoveryEvidenceDigest: null })._tag, "Refusal");
  assert.equal(compileExtensionTransition({ ...common, migrationEvidenceDigest: sha("unexpected") })._tag, "Refusal");
});
