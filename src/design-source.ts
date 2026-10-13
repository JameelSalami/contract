import { parseDocument } from "yaml";
import { canonicalDigest } from "./canonical.js";
import { contentDigest } from "./content-identity.js";
import { safeRelativePath } from "./internal.js";

export type DesignJson =
  | null
  | boolean
  | number
  | string
  | readonly DesignJson[]
  | { readonly [key: string]: DesignJson };

export type DesignTypographyToken = Readonly<Record<string, string | number>>;
export type DesignComponentToken = Readonly<Record<string, string>>;

export interface DesignSourceProjection {
  readonly schema: "contract.design-source-projection/v1";
  readonly source: {
    readonly ref: string;
    readonly kind: "design-md";
    readonly path: string;
    readonly digest: string;
  };
  readonly formatVersion: string | null;
  readonly name: string | null;
  readonly description: string | null;
  readonly omitted: readonly DesignJson[];
  readonly tokens: {
    readonly colors: Readonly<Record<string, string>>;
    readonly typography: Readonly<Record<string, DesignTypographyToken>>;
    readonly spacing: Readonly<Record<string, string | number>>;
    readonly rounded: Readonly<Record<string, string>>;
    readonly components: Readonly<Record<string, DesignComponentToken>>;
  };
  readonly extensions: Readonly<Record<string, DesignJson>>;
  readonly sections: readonly {
    readonly heading: string;
    readonly body: string;
  }[];
  readonly projectionDigest: string;
}

export type DesignSourceResult =
  | { readonly _tag: "DesignSourceProjection"; readonly projection: DesignSourceProjection }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-design-source"
        | "unsafe-design-source-path"
        | "invalid-design-frontmatter"
        | "invalid-design-token"
        | "duplicate-design-section"
        | "projection-not-canonicalizable";
    };

function isJson(value: unknown): value is DesignJson {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value as Record<string, unknown>).every(isJson);
}

function record(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringRecord(value: unknown): Readonly<Record<string, string>> | null {
  const input = record(value);
  if (input === null) return null;
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(input)) {
    if (!key || typeof item !== "string") return null;
    out[key] = item;
  }
  return Object.freeze(out);
}

function typographyRecord(
  value: unknown,
): Readonly<Record<string, DesignTypographyToken>> | null {
  const input = record(value);
  if (input === null) return null;
  const out: Record<string, DesignTypographyToken> = {};
  for (const [key, item] of Object.entries(input)) {
    const properties = record(item);
    if (!key || properties === null) return null;
    const normalized: Record<string, string | number> = {};
    for (const [property, propertyValue] of Object.entries(properties)) {
      if (
        !property ||
        !(
          typeof propertyValue === "string" ||
          (typeof propertyValue === "number" && Number.isFinite(propertyValue))
        )
      ) return null;
      normalized[property] = propertyValue;
    }
    out[key] = Object.freeze(normalized);
  }
  return Object.freeze(out);
}

function spacingRecord(
  value: unknown,
): Readonly<Record<string, string | number>> | null {
  const input = record(value);
  if (input === null) return null;
  const out: Record<string, string | number> = {};
  for (const [key, item] of Object.entries(input)) {
    if (
      !key ||
      !(
        typeof item === "string" ||
        (typeof item === "number" && Number.isFinite(item))
      )
    ) return null;
    out[key] = item;
  }
  return Object.freeze(out);
}

function componentRecord(
  value: unknown,
): Readonly<Record<string, DesignComponentToken>> | null {
  const input = record(value);
  if (input === null) return null;
  const out: Record<string, DesignComponentToken> = {};
  for (const [key, item] of Object.entries(input)) {
    const properties = stringRecord(item);
    if (!key || properties === null) return null;
    out[key] = properties;
  }
  return Object.freeze(out);
}

function splitFrontmatter(content: string): {
  readonly frontmatter: string | null;
  readonly markdown: string;
} | null {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: null, markdown: normalized };
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) return null;
  return {
    frontmatter: normalized.slice(4, end),
    markdown: normalized.slice(end + 5),
  };
}

function sections(markdown: string): readonly { readonly heading: string; readonly body: string }[] | null {
  const lines = markdown.split("\n");
  const out: { heading: string; body: string }[] = [];
  let current: { heading: string; bodyLines: string[] } | null = null;
  const seen = new Set<string>();

  const flush = () => {
    if (current === null) return;
    out.push({
      heading: current.heading,
      body: current.bodyLines.join("\n").trim(),
    });
  };

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      const heading = match[1]!.trim();
      const key = heading.toLowerCase();
      if (!heading || seen.has(key)) return null;
      seen.add(key);
      current = { heading, bodyLines: [] };
      continue;
    }
    if (current !== null) current.bodyLines.push(line);
  }
  flush();
  return Object.freeze(out.map((item) => Object.freeze(item)));
}

export function compileDesignSource(input: unknown): DesignSourceResult {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return { _tag: "Refusal", reason: "invalid-design-source" };
  }
  const keys = Object.keys(input as Record<string, unknown>).sort();
  if (keys.join("|") !== ["content", "kind", "path"].sort().join("|")) {
    return { _tag: "Refusal", reason: "invalid-design-source" };
  }

  const raw = input as Record<string, unknown>;
  if (
    raw.kind !== "design-md" ||
    typeof raw.path !== "string" ||
    typeof raw.content !== "string"
  ) {
    return { _tag: "Refusal", reason: "invalid-design-source" };
  }
  if (!safeRelativePath(raw.path)) {
    return { _tag: "Refusal", reason: "unsafe-design-source-path" };
  }

  const split = splitFrontmatter(raw.content);
  if (split === null) {
    return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
  }

  let frontmatter: Record<string, unknown> = {};
  if (split.frontmatter !== null) {
    const parsed = parseDocument(split.frontmatter, {
      schema: "core",
      uniqueKeys: true,
    });
    if (parsed.errors.length > 0 || parsed.warnings.length > 0) {
      return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
    }
    try {
      const value = parsed.toJS({ maxAliasCount: 0 });
      const asRecord = record(value);
      if (asRecord === null || !isJson(asRecord)) {
        return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
      }
      frontmatter = asRecord;
    } catch {
      return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
    }
  }

  const known = new Set([
    "version",
    "name",
    "description",
    "omitted",
    "colors",
    "typography",
    "spacing",
    "rounded",
    "components",
  ]);

  const colors = stringRecord(frontmatter.colors ?? {});
  const typography = typographyRecord(frontmatter.typography ?? {});
  const spacing = spacingRecord(frontmatter.spacing ?? {});
  const rounded = stringRecord(frontmatter.rounded ?? {});
  const components = componentRecord(frontmatter.components ?? {});
  if (
    colors === null ||
    typography === null ||
    spacing === null ||
    rounded === null ||
    components === null
  ) {
    return { _tag: "Refusal", reason: "invalid-design-token" };
  }

  if (
    frontmatter.version !== undefined &&
    typeof frontmatter.version !== "string"
  ) return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
  if (
    frontmatter.name !== undefined &&
    typeof frontmatter.name !== "string"
  ) return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
  if (
    frontmatter.description !== undefined &&
    typeof frontmatter.description !== "string"
  ) return { _tag: "Refusal", reason: "invalid-design-frontmatter" };

  const omittedValue = frontmatter.omitted ?? [];
  if (!Array.isArray(omittedValue) || !isJson(omittedValue)) {
    return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
  }

  const extensions: Record<string, DesignJson> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (known.has(key)) continue;
    if (!isJson(value)) {
      return { _tag: "Refusal", reason: "invalid-design-frontmatter" };
    }
    extensions[key] = value;
  }

  const parsedSections = sections(split.markdown);
  if (parsedSections === null) {
    return { _tag: "Refusal", reason: "duplicate-design-section" };
  }

  const body = {
    schema: "contract.design-source-projection/v1" as const,
    source: {
      ref: "design:" + raw.path,
      kind: "design-md" as const,
      path: raw.path,
      digest: contentDigest(raw.content),
    },
    formatVersion:
      typeof frontmatter.version === "string" ? frontmatter.version : null,
    name: typeof frontmatter.name === "string" ? frontmatter.name : null,
    description:
      typeof frontmatter.description === "string"
        ? frontmatter.description
        : null,
    omitted: Object.freeze([...omittedValue]) as readonly DesignJson[],
    tokens: Object.freeze({
      colors,
      typography,
      spacing,
      rounded,
      components,
    }),
    extensions: Object.freeze(extensions),
    sections: parsedSections,
  };

  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  return {
    _tag: "DesignSourceProjection",
    projection: Object.freeze({
      ...body,
      source: Object.freeze(body.source),
      projectionDigest: digest.digest,
    }),
  };
}
