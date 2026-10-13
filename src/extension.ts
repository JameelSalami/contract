import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import { decodeStrict, Digest, hasDuplicates, NonEmpty } from "./internal.js";

const Foundation = Schema.Literal("contract", "state", "trace", "assurance");
const Interface = Schema.Struct({ id: NonEmpty, version: NonEmpty });
const Sha = /^sha256:[0-9a-f]{64}$/;
const Capability = /^[a-z0-9][a-z0-9._:/-]*$/;
const Version = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?$/;

const ManifestInput = Schema.Struct({
  schema: Schema.Literal("contract.extension-manifest/v1"),
  id: NonEmpty,
  version: NonEmpty,
  foundation: Foundation,
  interface: Interface,
  capabilities: Schema.Array(NonEmpty),
  requiredChecks: Schema.Array(NonEmpty),
  configurationSchemaDigest: Schema.NullOr(Digest),
  authority: Schema.Literal("none"),
});

export interface ExtensionManifest {
  readonly schema: "contract.extension-manifest/v1";
  readonly id: string;
  readonly version: string;
  readonly foundation: "contract" | "state" | "trace" | "assurance";
  readonly interface: { readonly id: string; readonly version: string };
  readonly capabilities: readonly string[];
  readonly requiredChecks: readonly string[];
  readonly configurationSchemaDigest: string | null;
  readonly authority: "none";
  readonly digest: string;
}

export type ExtensionManifestResult =
  | { readonly _tag: "ExtensionManifest"; readonly manifest: ExtensionManifest }
  | { readonly _tag: "Refusal"; readonly reason: "invalid-extension-manifest" | "duplicate-extension-obligation" };

const validNames = (names: readonly string[]): boolean =>
  names.length > 0 && names.every((name) => Capability.test(name));

const sha = (value: unknown): value is string =>
  typeof value === "string" && Sha.test(value);

function frozenDigest<T extends Record<string, unknown>>(body: T): (T & { readonly digest: string }) | null {
  const result = canonicalDigest(body);
  return result._tag === "Digest" ? Object.freeze({ ...body, digest: result.digest }) : null;
}

/**
 * Discoverable, declarative metadata only. No extension code is loaded or
 * installed, and no actor can acquire permission from this compiler.
 */
export function compileExtensionManifest(input: unknown): ExtensionManifestResult {
  const value = decodeStrict(ManifestInput, input);
  if (
    value === null ||
    !Version.test(value.version) ||
    !validNames(value.capabilities) ||
    !validNames(value.requiredChecks)
  ) return { _tag: "Refusal", reason: "invalid-extension-manifest" };
  if (hasDuplicates(value.capabilities) || hasDuplicates(value.requiredChecks)) {
    return { _tag: "Refusal", reason: "duplicate-extension-obligation" };
  }
  const body = {
    schema: "contract.extension-manifest/v1" as const,
    id: value.id,
    version: value.version,
    foundation: value.foundation,
    interface: Object.freeze({ ...value.interface }),
    capabilities: Object.freeze([...value.capabilities].sort()),
    requiredChecks: Object.freeze([...value.requiredChecks].sort()),
    configurationSchemaDigest: value.configurationSchemaDigest,
    authority: "none" as const,
  };
  const compiled = frozenDigest(body);
  if (!compiled) return { _tag: "Refusal", reason: "invalid-extension-manifest" };
  return { _tag: "ExtensionManifest", manifest: compiled };
}

const DiscoveryInput = Schema.Struct({
  foundation: Foundation,
  interface: Interface,
  requiredCapabilities: Schema.Array(NonEmpty),
});

export type ExtensionDiscoveryResult =
  | { readonly _tag: "ExtensionDiscovery"; readonly manifests: readonly ExtensionManifest[]; readonly authority: "none" }
  | { readonly _tag: "Refusal"; readonly reason: "invalid-extension-query" | "invalid-extension-catalog" | "duplicate-extension-identity" };

/** Enumerate compatible manifests without downloading or evaluating any module. */
export function discoverExtensions(
  catalog: readonly ExtensionManifest[],
  query: unknown
): ExtensionDiscoveryResult {
  const requirement = decodeStrict(DiscoveryInput, query);
  if (requirement === null ||
      !requirement.requiredCapabilities.every((name) => Capability.test(name)) ||
      hasDuplicates(requirement.requiredCapabilities)) {
    return { _tag: "Refusal", reason: "invalid-extension-query" };
  }
  if (!Array.isArray(catalog)) {
    return { _tag: "Refusal", reason: "invalid-extension-catalog" };
  }
  const seen = new Set<string>();
  const results: ExtensionManifest[] = [];
  for (const supplied of catalog) {
    if (supplied === null || typeof supplied !== "object") {
      return { _tag: "Refusal", reason: "invalid-extension-catalog" };
    }
    const { digest, ...source } = supplied;
    const compiled = compileExtensionManifest(source);
    if (compiled._tag !== "ExtensionManifest" || compiled.manifest.digest !== digest) {
      return { _tag: "Refusal", reason: "invalid-extension-catalog" };
    }
    const entry = compiled.manifest;
    const key = [entry.foundation, entry.id, entry.version].join("\0");
    if (seen.has(key)) return { _tag: "Refusal", reason: "duplicate-extension-identity" };
    seen.add(key);
    if (
      entry.foundation === requirement.foundation &&
      entry.interface.id === requirement.interface.id &&
      entry.interface.version === requirement.interface.version &&
      requirement.requiredCapabilities.every((name) => entry.capabilities.includes(name))
    ) results.push(entry);
  }
  results.sort((a, b) =>
    [a.id, a.version, a.digest].join("\0").localeCompare([b.id, b.version, b.digest].join("\0")));
  return { _tag: "ExtensionDiscovery", manifests: Object.freeze(results), authority: "none" };
}

const BindingInput = Schema.Struct({
  schema: Schema.Literal("contract.extension-binding/v1"),
  projectId: NonEmpty,
  extensionId: NonEmpty,
  extensionVersion: NonEmpty,
  manifestDigest: Digest,
  configurationDigest: Digest,
  qualificationDigest: Digest,
  authority: Schema.Literal("none"),
});

export interface ExtensionBinding {
  readonly schema: "contract.extension-binding/v1";
  readonly projectId: string;
  readonly extensionId: string;
  readonly extensionVersion: string;
  readonly manifestDigest: string;
  readonly configurationDigest: string;
  readonly qualificationDigest: string;
  readonly authority: "none";
  readonly digest: string;
}

export type ExtensionBindingResult =
  | { readonly _tag: "ExtensionBinding"; readonly binding: ExtensionBinding }
  | { readonly _tag: "Refusal"; readonly reason: "invalid-extension-binding" | "extension-identity-mismatch" };

/**
 * Candidate binding: the app must independently authenticate qualificationDigest
 * and decide whether to admit it. A digest reference is not a permission.
 */
export function compileExtensionBinding(input: unknown, manifest: ExtensionManifest): ExtensionBindingResult {
  const value = decodeStrict(BindingInput, input);
  if (value === null) return { _tag: "Refusal", reason: "invalid-extension-binding" };
  const { digest, ...unsigned } = manifest;
  const compiled = compileExtensionManifest(unsigned);
  if (
    compiled._tag !== "ExtensionManifest" ||
    compiled.manifest.digest !== digest ||
    value.extensionId !== manifest.id ||
    value.extensionVersion !== manifest.version ||
    value.manifestDigest !== digest
  ) return { _tag: "Refusal", reason: "extension-identity-mismatch" };
  const body = {
    schema: "contract.extension-binding/v1" as const,
    projectId: value.projectId,
    extensionId: value.extensionId,
    extensionVersion: value.extensionVersion,
    manifestDigest: value.manifestDigest,
    configurationDigest: value.configurationDigest,
    qualificationDigest: value.qualificationDigest,
    authority: "none" as const,
  };
  const result = frozenDigest(body);
  return result
    ? { _tag: "ExtensionBinding", binding: result }
    : { _tag: "Refusal", reason: "invalid-extension-binding" };
}

const TransitionInput = Schema.Struct({
  schema: Schema.Literal("contract.extension-transition/v1"),
  projectId: NonEmpty,
  operation: Schema.Literal("install", "upgrade", "replace", "remove", "rollback"),
  previousBindingDigest: Schema.NullOr(Digest),
  nextBindingDigest: Schema.NullOr(Digest),
  effect: Schema.Literal("configuration-only", "data-migration"),
  qualificationEvidenceDigest: Digest,
  authorizationEvidenceDigest: Digest,
  recoveryEvidenceDigest: Schema.NullOr(Digest),
  migrationEvidenceDigest: Schema.NullOr(Digest),
  requestedBy: Schema.Struct({
    kind: Schema.Literal("human", "agent"),
    id: NonEmpty,
  }),
  authority: Schema.Literal("none"),
});

export interface ExtensionTransition {
  readonly schema: "contract.extension-transition/v1";
  readonly projectId: string;
  readonly operation: "install" | "upgrade" | "replace" | "remove" | "rollback";
  readonly previousBindingDigest: string | null;
  readonly nextBindingDigest: string | null;
  readonly effect: "configuration-only" | "data-migration";
  readonly qualificationEvidenceDigest: string;
  readonly authorizationEvidenceDigest: string;
  readonly recoveryEvidenceDigest: string | null;
  readonly migrationEvidenceDigest: string | null;
  readonly requestedBy: { readonly kind: "human" | "agent"; readonly id: string };
  readonly authority: "none";
  readonly digest: string;
}

export type ExtensionTransitionResult =
  | { readonly _tag: "ExtensionTransition"; readonly transition: ExtensionTransition }
  | { readonly _tag: "Refusal"; readonly reason:
      "invalid-extension-transition" | "invalid-extension-lifecycle" | "missing-extension-recovery-evidence" };

/**
 * Describes an intended transition. The host must independently verify
 * authorization, conformance, and migration evidence before ANY effect.
 */
export function compileExtensionTransition(input: unknown): ExtensionTransitionResult {
  const value = decodeStrict(TransitionInput, input);
  if (value === null) return { _tag: "Refusal", reason: "invalid-extension-transition" };
  const hasPrevious = value.previousBindingDigest !== null;
  const hasNext = value.nextBindingDigest !== null;
  const validOperation = value.operation === "install" ? !hasPrevious && hasNext
    : value.operation === "remove" ? hasPrevious && !hasNext
    : hasPrevious && hasNext && value.previousBindingDigest !== value.nextBindingDigest;
  if (!validOperation) {
    return { _tag: "Refusal", reason: "invalid-extension-lifecycle" };
  }
  if ((hasPrevious && value.recoveryEvidenceDigest === null) ||
      (value.effect === "data-migration" && value.migrationEvidenceDigest === null)) {
    return { _tag: "Refusal", reason: "missing-extension-recovery-evidence" };
  }
  if (value.effect === "configuration-only" && value.migrationEvidenceDigest !== null) {
    return { _tag: "Refusal", reason: "invalid-extension-lifecycle" };
  }
  const body = {
    schema: "contract.extension-transition/v1" as const,
    projectId: value.projectId,
    operation: value.operation,
    previousBindingDigest: value.previousBindingDigest,
    nextBindingDigest: value.nextBindingDigest,
    effect: value.effect,
    qualificationEvidenceDigest: value.qualificationEvidenceDigest,
    authorizationEvidenceDigest: value.authorizationEvidenceDigest,
    recoveryEvidenceDigest: value.recoveryEvidenceDigest,
    migrationEvidenceDigest: value.migrationEvidenceDigest,
    requestedBy: Object.freeze({ ...value.requestedBy }),
    authority: "none" as const,
  };
  const result = frozenDigest(body);
  return result
    ? { _tag: "ExtensionTransition", transition: result }
    : { _tag: "Refusal", reason: "invalid-extension-transition" };
}
