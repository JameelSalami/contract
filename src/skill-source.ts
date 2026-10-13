import { parseDocument } from "yaml";
import { canonicalDigest } from "./canonical.js";
import { contentDigest } from "./content-identity.js";
import { compareText, safeRelativePath, sortedUnique } from "./internal.js";

export type SkillJson =
  | null
  | boolean
  | number
  | string
  | readonly SkillJson[]
  | { readonly [key: string]: SkillJson };

export interface SkillSourceProjection {
  readonly schema: "contract.skill-source-projection/v1";
  readonly source: {
    readonly ref: string;
    readonly name: string;
    readonly root: string;
    readonly entrypoint: string;
    readonly entrypointDigest: string;
    readonly closureDigest: string;
  };
  readonly metadata: {
    readonly description: string;
    readonly requiredTools: readonly string[];
    readonly capabilities: readonly string[];
    readonly license: string | null;
    readonly extensions: Readonly<Record<string, SkillJson>>;
  };
  readonly files: readonly {
    readonly path: string;
    readonly kind: string;
    readonly mediaType: string;
    readonly digest: string;
    readonly bytes: number;
    readonly content: string;
  }[];
  readonly projectionDigest: string;
}

export type SkillSourceResult =
  | { readonly _tag: "SkillSourceProjection"; readonly projection: SkillSourceProjection }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-skill-source"
        | "unsafe-skill-source-path"
        | "duplicate-skill-file"
        | "missing-skill-entrypoint"
        | "invalid-skill-frontmatter"
        | "projection-not-canonicalizable";
    };

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function jsonValue(value: unknown): value is SkillJson {
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
  if (!Array.isArray(value) || !value.every(nonEmpty)) return null;
  return Object.freeze(sortedUnique(value));
}

function frontmatter(content: string): { readonly metadata: Record<string, unknown>; readonly body: string } | null {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return null;
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return null;

  const parsed = parseDocument(normalized.slice(4, end), {
    schema: "core",
    uniqueKeys: true,
  });
  if (parsed.errors.length > 0 || parsed.warnings.length > 0) return null;
  try {
    const value = parsed.toJS({ maxAliasCount: 0 });
    const metadata = record(value);
    if (metadata === null || !jsonValue(metadata)) return null;
    return { metadata, body: normalized.slice(end + 5) };
  } catch {
    return null;
  }
}

export function compileSkillSource(input: unknown): SkillSourceResult {
  const raw = record(input);
  if (
    raw === null ||
    !exactKeys(raw, ["root", "entrypoint", "files"]) ||
    !nonEmpty(raw.root) ||
    !safeRelativePath(raw.root) ||
    !nonEmpty(raw.entrypoint) ||
    !safeRelativePath(raw.entrypoint) ||
    !Array.isArray(raw.files) ||
    raw.files.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-skill-source" };
  }

  const files: {
    path: string;
    kind: string;
    mediaType: string;
    digest: string;
    bytes: number;
    content: string;
  }[] = [];
  const paths = new Set<string>();
  for (const item of raw.files) {
    const file = record(item);
    if (
      file === null ||
      !exactKeys(file, ["path", "kind", "mediaType", "content"]) ||
      !nonEmpty(file.path) ||
      !safeRelativePath(file.path) ||
      !nonEmpty(file.kind) ||
      !nonEmpty(file.mediaType) ||
      typeof file.content !== "string"
    ) {
      return { _tag: "Refusal", reason: "invalid-skill-source" };
    }
    if (paths.has(file.path)) {
      return { _tag: "Refusal", reason: "duplicate-skill-file" };
    }
    paths.add(file.path);
    files.push({
      path: file.path,
      kind: file.kind,
      mediaType: file.mediaType,
      digest: contentDigest(file.content),
      bytes: Buffer.byteLength(file.content, "utf8"),
      content: file.content,
    });
  }

  const entrypoint = files.find((file) => file.path === raw.entrypoint);
  if (entrypoint === undefined) {
    return { _tag: "Refusal", reason: "missing-skill-entrypoint" };
  }
  const parsed = frontmatter(entrypoint.content);
  if (parsed === null) {
    return { _tag: "Refusal", reason: "invalid-skill-frontmatter" };
  }
  const metadata = parsed.metadata;
  if (!nonEmpty(metadata.name) || !nonEmpty(metadata.description)) {
    return { _tag: "Refusal", reason: "invalid-skill-frontmatter" };
  }
  if (metadata.license !== undefined && !nonEmpty(metadata.license)) {
    return { _tag: "Refusal", reason: "invalid-skill-frontmatter" };
  }
  const requiredTools = stringList(metadata.required_tools);
  const capabilities = stringList(metadata.capabilities);
  if (requiredTools === null || capabilities === null) {
    return { _tag: "Refusal", reason: "invalid-skill-frontmatter" };
  }

  const known = new Set(["name", "description", "required_tools", "capabilities", "license"]);
  const extensions: Record<string, SkillJson> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (known.has(key)) continue;
    if (!jsonValue(value)) {
      return { _tag: "Refusal", reason: "invalid-skill-frontmatter" };
    }
    extensions[key] = value;
  }

  const normalizedFiles = Object.freeze(
    files
      .map((file) => Object.freeze({ ...file }))
      .sort((a, b) => compareText(a.path, b.path)),
  );
  const manifest = normalizedFiles.map(({ path, kind, mediaType, digest, bytes }) => ({
    path,
    kind,
    mediaType,
    digest,
    bytes,
  }));
  const closure = canonicalDigest({
    root: raw.root,
    entrypoint: raw.entrypoint,
    name: metadata.name,
    files: manifest,
  });
  if (closure._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  const source = Object.freeze({
    ref: "skill:" + metadata.name,
    name: metadata.name,
    root: raw.root,
    entrypoint: raw.entrypoint,
    entrypointDigest: entrypoint.digest,
    closureDigest: closure.digest,
  });
  const body = {
    schema: "contract.skill-source-projection/v1" as const,
    source,
    metadata: Object.freeze({
      description: metadata.description,
      requiredTools,
      capabilities,
      license: typeof metadata.license === "string" ? metadata.license : null,
      extensions: Object.freeze(extensions),
    }),
    files: normalizedFiles,
  };
  const projection = canonicalDigest({
    ...body,
    files: manifest,
  });
  if (projection._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  return {
    _tag: "SkillSourceProjection",
    projection: Object.freeze({
      ...body,
      projectionDigest: projection.digest,
    }),
  };
}
