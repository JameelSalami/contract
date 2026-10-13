import { compareText } from "./internal.js";
import type { ArtifactManifest, ArtifactOwnership } from "./artifact-manifest.js";

export interface ObservedArtifact {
  readonly path: string;
  readonly digest: string;
}

export interface ArtifactDriftEntry {
  readonly path: string;
  readonly ref: string | null;
  readonly ownership: ArtifactOwnership | null;
  readonly expectedDigest: string | null;
  readonly observedDigest: string | null;
  readonly status: "current" | "content-mismatch" | "missing" | "untracked";
}

export interface ArtifactDriftObservation {
  readonly schema: "contract.artifact-drift/v1";
  readonly manifestDigest: string;
  readonly entries: readonly ArtifactDriftEntry[];
}

export function observeArtifactDrift(
  manifest: ArtifactManifest,
  observed: readonly ObservedArtifact[],
): ArtifactDriftObservation {
  const observedByPath = new Map(observed.map((item) => [item.path, item]));
  const expectedPaths = new Set(manifest.artifacts.map((artifact) => artifact.path));
  const entries: ArtifactDriftEntry[] = [];

  for (const artifact of manifest.artifacts) {
    const actual = observedByPath.get(artifact.path);
    entries.push({
      path: artifact.path,
      ref: artifact.ref,
      ownership: artifact.ownership,
      expectedDigest: artifact.digest,
      observedDigest: actual?.digest ?? null,
      status:
        actual === undefined
          ? "missing"
          : actual.digest === artifact.digest
            ? "current"
            : "content-mismatch",
    });
  }

  for (const actual of observed) {
    if (expectedPaths.has(actual.path)) continue;
    entries.push({
      path: actual.path,
      ref: null,
      ownership: null,
      expectedDigest: null,
      observedDigest: actual.digest,
      status: "untracked",
    });
  }

  return Object.freeze({
    schema: "contract.artifact-drift/v1",
    manifestDigest: manifest.digest,
    entries: Object.freeze(
      entries
        .sort((a, b) => compareText(a.path, b.path))
        .map((entry) => Object.freeze(entry)),
    ),
  });
}
