import { Schema } from "effect";
import { compareText, NonEmpty, decodeStrict, hasDuplicates, sortedUnique } from "./internal.js";

const InputSchema = Schema.Struct({
  nodes: Schema.Array(NonEmpty),
  edges: Schema.Array(
    Schema.Struct({
      from: NonEmpty,
      to: NonEmpty,
      relation: NonEmpty,
    }),
  ),
  changedRefs: Schema.Array(NonEmpty),
  propagatingRelations: Schema.optional(Schema.Array(NonEmpty)),
});

export interface ChangeImpact {
  readonly schema: "contract.change-impact/v1";
  readonly changedRefs: readonly string[];
  readonly affectedRefs: readonly string[];
}

export type ChangeImpactResult =
  | { readonly _tag: "ChangeImpact"; readonly impact: ChangeImpact }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-dependency-graph"
        | "duplicate-node"
        | "duplicate-edge"
        | "undeclared-reference";
    };

export function calculateChangeImpact(input: unknown): ChangeImpactResult {
  const decoded = decodeStrict(InputSchema, input);
  if (decoded === null || decoded.nodes.length === 0) {
    return { _tag: "Refusal", reason: "invalid-dependency-graph" };
  }

  if (hasDuplicates(decoded.nodes)) {
    return { _tag: "Refusal", reason: "duplicate-node" };
  }

  const edgeKeys = decoded.edges.map(
    (edge) => edge.from + "\u0000" + edge.to + "\u0000" + edge.relation,
  );
  if (hasDuplicates(edgeKeys)) {
    return { _tag: "Refusal", reason: "duplicate-edge" };
  }

  const nodes = new Set(decoded.nodes);
  if (
    decoded.changedRefs.some((ref) => !nodes.has(ref)) ||
    decoded.edges.some((edge) => !nodes.has(edge.from) || !nodes.has(edge.to))
  ) {
    return { _tag: "Refusal", reason: "undeclared-reference" };
  }

  if (
    decoded.propagatingRelations !== undefined &&
    hasDuplicates(decoded.propagatingRelations)
  ) {
    return { _tag: "Refusal", reason: "invalid-dependency-graph" };
  }

  const propagating =
    decoded.propagatingRelations === undefined
      ? null
      : new Set(decoded.propagatingRelations);

  const outgoing = new Map<string, string[]>();
  for (const edge of decoded.edges) {
    if (propagating !== null && !propagating.has(edge.relation)) continue;
    const values = outgoing.get(edge.from) ?? [];
    values.push(edge.to);
    outgoing.set(edge.from, values);
  }

  const changedRefs = sortedUnique(decoded.changedRefs);
  const visited = new Set(changedRefs);
  const queue = [...changedRefs];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of outgoing.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  for (const changed of changedRefs) visited.delete(changed);

  return {
    _tag: "ChangeImpact",
    impact: Object.freeze({
      schema: "contract.change-impact/v1",
      changedRefs: Object.freeze(changedRefs),
      affectedRefs: Object.freeze([...visited].sort((a, b) => compareText(a, b))),
    }),
  };
}
