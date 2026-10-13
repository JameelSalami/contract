import { parseDocument } from "yaml";
import { canonicalDigest } from "./canonical.js";
import { contentDigest } from "./content-identity.js";
import { safeRelativePath, sortedUnique } from "./internal.js";

export type GuidanceJson =
  | null
  | boolean
  | number
  | string
  | readonly GuidanceJson[]
  | { readonly [key: string]: GuidanceJson };

export interface GuidanceSourceProjection {
  readonly schema: "contract.guidance-source-projection/v1";
  readonly source: {
    readonly ref: string;
    readonly format: string;
    readonly path: string;
    readonly digest: string;
  };
  readonly metadata: {
    readonly description: string | null;
    readonly globs: readonly string[];
    readonly global: boolean | null;
    readonly alwaysApply: boolean | null;
    readonly requiredTools: readonly string[];
    readonly requiredPhrases: readonly string[];
    readonly forbiddenPhrases: readonly string[];
    readonly extensions: Readonly<Record<string, GuidanceJson>>;
  };
  readonly body: string;
  readonly projectionDigest: string;
}

export type GuidanceSourceResult =
  | { readonly _tag: "GuidanceSourceProjection"; readonly projection: GuidanceSourceProjection }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-guidance-source"
        | "unsafe-guidance-source-path"
        | "invalid-guidance-frontmatter"
        | "projection-not-canonicalizable";
    };

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function jsonValue(value: unknown): value is GuidanceJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") {
    return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  }
  if (Array.isArray(value)) return value.every(jsonValue);
  const object = record(value);
  if (object === null) return false;
  return Object.values(object).every(jsonValue);
}

function stringList(value: unknown): readonly string[] | null {
  if (value === undefined) return Object.freeze([]);
  if (nonEmpty(value)) return Object.freeze([value]);
  if (!Array.isArray(value) || !value.every(nonEmpty)) return null;
  return Object.freeze(sortedUnique(value));
}

function splitMdc(content: string): { readonly frontmatter: string; readonly body: string } | null {
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.startsWith("---\n")) {
    const end = normalized.indexOf("\n---\n", 4);
    if (end < 0) return null;
    return {
      frontmatter: normalized.slice(4, end),
      body: normalized.slice(end + 5),
    };
  }
  const end = normalized.indexOf("\n---\n");
  if (end < 0) return null;
  return {
    frontmatter: normalized.slice(0, end),
    body: normalized.slice(end + 5),
  };
}

function parseMetadata(frontmatter: string): GuidanceSourceProjection["metadata"] | null {
  const parsed = parseDocument(frontmatter, { schema: "core", uniqueKeys: true });
  if (parsed.errors.length > 0 || parsed.warnings.length > 0) return null;

  let raw: Record<string, unknown>;
  try {
    const value = parsed.toJS({ maxAliasCount: 0 });
    const object = record(value);
    if (object === null || !jsonValue(object)) return null;
    raw = object;
  } catch {
    return null;
  }

  if (raw.description !== undefined && !nonEmpty(raw.description)) return null;
  if (raw.global !== undefined && typeof raw.global !== "boolean") return null;
  if (raw.alwaysApply !== undefined && typeof raw.alwaysApply !== "boolean") return null;

  const globs = stringList(raw.globs);
  const requiredTools = stringList(raw.required_tools);
  const requiredPhrases = stringList(raw.required_phrases);
  const forbiddenPhrases = stringList(raw.forbidden_phrases);
  if (
    globs === null ||
    requiredTools === null ||
    requiredPhrases === null ||
    forbiddenPhrases === null
  ) return null;

  const known = new Set([
    "description",
    "globs",
    "global",
    "alwaysApply",
    "required_tools",
    "required_phrases",
    "forbidden_phrases",
  ]);
  const extensions: Record<string, GuidanceJson> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (known.has(key)) continue;
    if (!jsonValue(value)) return null;
    extensions[key] = value;
  }

  return Object.freeze({
    description: typeof raw.description === "string" ? raw.description : null,
    globs,
    global: typeof raw.global === "boolean" ? raw.global : null,
    alwaysApply: typeof raw.alwaysApply === "boolean" ? raw.alwaysApply : null,
    requiredTools,
    requiredPhrases,
    forbiddenPhrases,
    extensions: Object.freeze(extensions),
  });
}

function emptyMetadata(): GuidanceSourceProjection["metadata"] {
  return Object.freeze({
    description: null,
    globs: Object.freeze([]),
    global: null,
    alwaysApply: null,
    requiredTools: Object.freeze([]),
    requiredPhrases: Object.freeze([]),
    forbiddenPhrases: Object.freeze([]),
    extensions: Object.freeze({}),
  });
}

export function compileGuidanceSource(input: unknown): GuidanceSourceResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { _tag: "Refusal", reason: "invalid-guidance-source" };
  }
  const raw = input as Record<string, unknown>;
  const keys = Object.keys(raw).sort();
  if (
    keys.join("|") !== ["content", "format", "path"].sort().join("|") ||
    !nonEmpty(raw.format) ||
    !nonEmpty(raw.path) ||
    typeof raw.content !== "string"
  ) {
    return { _tag: "Refusal", reason: "invalid-guidance-source" };
  }
  if (!safeRelativePath(raw.path)) {
    return { _tag: "Refusal", reason: "unsafe-guidance-source-path" };
  }

  let metadata = emptyMetadata();
  let body = raw.content.replace(/\r\n/g, "\n");
  if (raw.format === "mdc") {
    const split = splitMdc(raw.content);
    if (split === null) {
      return { _tag: "Refusal", reason: "invalid-guidance-frontmatter" };
    }
    const parsed = parseMetadata(split.frontmatter);
    if (parsed === null) {
      return { _tag: "Refusal", reason: "invalid-guidance-frontmatter" };
    }
    metadata = parsed;
    body = split.body;
  }

  const source = Object.freeze({
    ref: "guidance:" + raw.path,
    format: raw.format,
    path: raw.path,
    digest: contentDigest(raw.content),
  });
  const normalized = {
    schema: "contract.guidance-source-projection/v1" as const,
    source,
    metadata,
    body,
  };
  const digest = canonicalDigest(normalized);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  return {
    _tag: "GuidanceSourceProjection",
    projection: Object.freeze({
      ...normalized,
      projectionDigest: digest.digest,
    }),
  };
}
