import { canonicalDigest } from "./canonical.js";
import { safeRelativePath, sha256Text } from "./internal.js";

export interface DocumentSource {
  readonly ref: string;
  readonly digest: string;
}

export interface DocumentOutput {
  readonly ref: string;
  readonly kind: string;
  readonly path: string;
  readonly mediaType: string;
  readonly content: string;
}

export interface DocumentProjectionFile extends DocumentOutput {
  readonly ownership: "generated";
  readonly digest: string;
  readonly sourceRefs: readonly string[];
  readonly generator: {
    readonly id: string;
    readonly version: string;
  };
}

export interface DocumentProjection {
  readonly schema: "contract.document-projection/v1";
  readonly source: DocumentSource;
  readonly generator: { readonly id: string; readonly version: string };
  readonly files: readonly DocumentProjectionFile[];
  readonly digest: string;
}

export type DocumentProjectionResult =
  | { readonly _tag: "DocumentProjection"; readonly projection: DocumentProjection }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-document-adapter"
        | "invalid-document-output"
        | "unsafe-document-path"
        | "duplicate-document-ref"
        | "duplicate-document-path"
        | "nondeterministic-adapter"
        | "projection-not-canonicalizable";
    };

type DocumentProjectionRefusal = Extract<
  DocumentProjectionResult,
  { readonly _tag: "Refusal" }
>;

type NormalizedOutputs =
  | { readonly _tag: "Normalized"; readonly outputs: readonly DocumentOutput[] }
  | DocumentProjectionRefusal;

function normalizeOutputs(
  raw: readonly DocumentOutput[],
): NormalizedOutputs {
  const refs = new Set<string>();
  const paths = new Set<string>();
  const outputs: DocumentOutput[] = [];

  for (const output of raw) {
    if (
      typeof output !== "object" ||
      output === null ||
      typeof output.ref !== "string" ||
      output.ref.length === 0 ||
      typeof output.kind !== "string" ||
      output.kind.length === 0 ||
      typeof output.path !== "string" ||
      typeof output.mediaType !== "string" ||
      output.mediaType.length === 0 ||
      typeof output.content !== "string"
    ) {
      return { _tag: "Refusal", reason: "invalid-document-output" };
    }
    if (!safeRelativePath(output.path)) {
      return { _tag: "Refusal", reason: "unsafe-document-path" };
    }
    if (refs.has(output.ref)) {
      return { _tag: "Refusal", reason: "duplicate-document-ref" };
    }
    if (paths.has(output.path)) {
      return { _tag: "Refusal", reason: "duplicate-document-path" };
    }
    refs.add(output.ref);
    paths.add(output.path);
    outputs.push({
      ref: output.ref,
      kind: output.kind,
      path: output.path,
      mediaType: output.mediaType,
      content: output.content,
    });
  }

  return {
    _tag: "Normalized",
    outputs: outputs.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function projectDocuments<T>(input: {
  readonly source: DocumentSource;
  readonly adapter: {
    readonly id: string;
    readonly version: string;
    readonly render: (input: T) => readonly DocumentOutput[];
  };
  readonly input: T;
}): DocumentProjectionResult {
  if (
    typeof input.source.ref !== "string" ||
    input.source.ref.length === 0 ||
    !/^sha256:[0-9a-f]{64}$/.test(input.source.digest) ||
    typeof input.adapter.id !== "string" ||
    input.adapter.id.length === 0 ||
    typeof input.adapter.version !== "string" ||
    input.adapter.version.length === 0 ||
    typeof input.adapter.render !== "function"
  ) {
    return { _tag: "Refusal", reason: "invalid-document-adapter" };
  }

  let firstRaw: readonly DocumentOutput[];
  let secondRaw: readonly DocumentOutput[];
  try {
    firstRaw = input.adapter.render(structuredClone(input.input));
    secondRaw = input.adapter.render(structuredClone(input.input));
  } catch {
    return { _tag: "Refusal", reason: "invalid-document-output" };
  }

  if (!Array.isArray(firstRaw) || !Array.isArray(secondRaw)) {
    return { _tag: "Refusal", reason: "invalid-document-output" };
  }
  const first = normalizeOutputs(firstRaw);
  if (first._tag === "Refusal") return first;
  const second = normalizeOutputs(secondRaw);
  if (second._tag === "Refusal") return second;

  if (JSON.stringify(first.outputs) !== JSON.stringify(second.outputs)) {
    return { _tag: "Refusal", reason: "nondeterministic-adapter" };
  }

  const generator = {
    id: input.adapter.id,
    version: input.adapter.version,
  };
  const files: DocumentProjectionFile[] = first.outputs.map((output) => ({
    ...output,
    ownership: "generated",
    digest: sha256Text(output.content),
    sourceRefs: [input.source.ref],
    generator,
  }));

  const body = {
    schema: "contract.document-projection/v1" as const,
    source: {
      ref: input.source.ref,
      digest: input.source.digest,
    },
    generator,
    files,
  };
  const digest = canonicalDigest(body);
  if (digest._tag !== "Digest") {
    return { _tag: "Refusal", reason: "projection-not-canonicalizable" };
  }

  return {
    _tag: "DocumentProjection",
    projection: Object.freeze({
      ...body,
      source: Object.freeze(body.source),
      generator: Object.freeze(body.generator),
      files: Object.freeze(
        files.map((file) =>
          Object.freeze({
            ...file,
            sourceRefs: Object.freeze([...file.sourceRefs]),
            generator: Object.freeze({ ...file.generator }),
          }),
        ),
      ),
      digest: digest.digest,
    }),
  };
}
