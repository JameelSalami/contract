import { Schema } from "effect";
import { canonicalDigest } from "./canonical.js";
import {
  Digest,
  IdentitySchema,
  NonEmpty,
  decodeStrict,
  hasDuplicates,
  safeRelativePath,
  sortedUnique,
} from "./internal.js";

const ArtifactSchema = Schema.Struct({
  ref: NonEmpty,
  kind: NonEmpty,
  path: NonEmpty,
  ownership: Schema.Literal("generated", "human", "external"),
  digest: Digest,
  sourceRefs: Schema.Array(NonEmpty),
  generator: Schema.optional(IdentitySchema),
});

const ManifestInputSchema = Schema.Struct({
  projectId: NonEmpty,
  artifacts: Schema.Array(ArtifactSchema),
});

export type ArtifactOwnership = "generated" | "human" | "external";

export interface ArtifactRecord {
  readonly ref: string;
  readonly kind: string;
  readonly path: string;
  readonly ownership: ArtifactOwnership;
  readonly digest: string;
  readonly sourceRefs: readonly string[];
  readonly generator?: {
    readonly id: string;
    readonly version: string;
  };
}

export interface ArtifactManifest {
  readonly schema: "contract.artifact-manifest/v1";
  readonly projectId: string;
  readonly artifacts: readonly ArtifactRecord[];
  readonly digest: string;
}

export type ArtifactManifestResult =
  | { readonly _tag: "ArtifactManifest"; readonly manifest: ArtifactManifest }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-artifact-manifest"
        | "unsafe-artifact-path"
        | "duplicate-artifact-ref"
        | "duplicate-artifact-path"
        | "invalid-artifact-ownership"
        | "manifest-not-canonicalizable";
    };

export function compileArtifactManifest(input: unknown): ArtifactManifestResult {
  const decoded = decodeStrict(ManifestInputSchema, input);
  if (decoded === null) {
    return { _tag: "Refusal", reason: "invalid-artifact-manifest" };
  }

  if (hasDuplicates(decoded.artifacts.map((artifact) => artifact.ref))) {
    return { _tag: "Refusal", reason: "duplicate-artifact-ref" };
  }
  if (hasDuplicates(decoded.artifacts.map((artifact) => artifact.path))) {
    return { _tag: "Refusal", reason: "duplicate-artifact-path" };
  }

  const artifacts: ArtifactRecord[] = [];
  for (const artifact of decoded.artifacts) {
    if (!safeRelativePath(artifact.path)) {
      return { _tag: "Refusal", reason: "unsafe-artifact-path" };
    }

    if (
      (artifact.ownership === "generated" &&
        (artifact.generator === undefined || artifact.sourceRefs.length === 0)) ||
      (artifact.ownership !== "generated" && artifact.generator !== undefined)
    ) {
      return { _tag: "Refusal", reason: "invalid-artifact-ownership" };
    }

    artifacts.push({
      ref: artifact.ref,
      kind: artifact.kind,
      path: artifact.path,
      ownership: artifact.ownership,
      digest: artifact.digest,
      sourceRefs: sortedUnique(artifact.sourceRefs),
      ...(artifact.generator !== undefined
        ? {
            generator: {
              id: artifact.generator.id,
              version: artifact.generator.version,
            },
          }
        : {}),
    });
  }

  artifacts.sort((a, b) => a.ref.localeCompare(b.ref));
  const body = {
    schema: "contract.artifact-manifest/v1" as const,
    projectId: decoded.projectId,
    artifacts,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "manifest-not-canonicalizable" };
  }

  return {
    _tag: "ArtifactManifest",
    manifest: Object.freeze({
      ...body,
      artifacts: Object.freeze(
        artifacts.map((artifact) =>
          Object.freeze({
            ...artifact,
            sourceRefs: Object.freeze([...artifact.sourceRefs]),
            ...(artifact.generator
              ? { generator: Object.freeze({ ...artifact.generator }) }
              : {}),
          }),
        ),
      ),
      digest: digest.digest,
    }),
  };
}
