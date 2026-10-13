import { canonicalDigest } from "./canonical.js";
import { contentDigest } from "./content-identity.js";
import { safeRelativePath } from "./internal.js";

export interface DocumentSourceProjection {
  readonly schema: "contract.document-source-projection/v1";
  readonly source: {
    readonly ref: string;
    readonly kind: string;
    readonly path: string;
    readonly mediaType: string;
    readonly ownership: "human" | "generated";
    readonly digest: string;
  };
  readonly title: string | null;
  readonly headings: readonly {
    readonly level: number;
    readonly text: string;
  }[];
  readonly projectionDigest: string;
}

export type DocumentSourceResult =
  | { readonly _tag: "DocumentSourceProjection"; readonly projection: DocumentSourceProjection }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-document-source"
        | "unsafe-document-source-path"
        | "projection-not-canonicalizable";
    };

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => expected.has(key));
}

function headings(content: string): readonly { readonly level: number; readonly text: string }[] {
  const out: { level: number; text: string }[] = [];
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match === null) continue;
    out.push({ level: match[1]!.length, text: match[2]!.trim() });
  }
  return Object.freeze(out.map((item) => Object.freeze(item)));
}

export function compileDocumentSource(input: unknown): DocumentSourceResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { _tag: "Refusal", reason: "invalid-document-source" };
  }
  const raw = input as Record<string, unknown>;
  if (
    !exactKeys(raw, ["kind", "path", "mediaType", "ownership", "content"]) ||
    !nonEmpty(raw.kind) ||
    !nonEmpty(raw.path) ||
    !nonEmpty(raw.mediaType) ||
    (raw.ownership !== "human" && raw.ownership !== "generated") ||
    typeof raw.content !== "string"
  ) {
    return { _tag: "Refusal", reason: "invalid-document-source" };
  }
  if (!safeRelativePath(raw.path)) {
    return { _tag: "Refusal", reason: "unsafe-document-source-path" };
  }

  const parsedHeadings = raw.mediaType === "text/markdown"
    ? headings(raw.content)
    : Object.freeze([] as { readonly level: number; readonly text: string }[]);
  const title = parsedHeadings.find((item) => item.level === 1)?.text ?? null;
  const source = Object.freeze({
    ref: "document:" + raw.path,
    kind: raw.kind,
    path: raw.path,
    mediaType: raw.mediaType,
    ownership: raw.ownership,
    digest: contentDigest(raw.content),
  });
  const body = {
    schema: "contract.document-source-projection/v1" as const,
    source,
    title,
    headings: parsedHeadings,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  return {
    _tag: "DocumentSourceProjection",
    projection: Object.freeze({
      ...body,
      projectionDigest: digest.digest,
    }),
  };
}
