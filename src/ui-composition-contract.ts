import { Schema } from "effect";
import { compareText, NonEmpty, decodeStrict, hasDuplicates, sortedUnique } from "./internal.js";

const LawSchema = Schema.Struct({
  id: NonEmpty,
  rule: NonEmpty,
  verificationClasses: Schema.Array(NonEmpty),
});

const VocabularySchema = Schema.Struct({
  semanticRoles: Schema.Array(NonEmpty),
  layoutPrimitives: Schema.Array(NonEmpty),
  projectionKinds: Schema.Array(NonEmpty),
  priorityLevels: Schema.Array(NonEmpty),
  densityLevels: Schema.Array(NonEmpty),
  viewportClasses: Schema.Array(NonEmpty),
  splitRatios: Schema.Array(NonEmpty),
  collapseModes: Schema.Array(NonEmpty),
  spaceRoles: Schema.Array(NonEmpty),
  surfaceRoles: Schema.Array(NonEmpty),
  toneRoles: Schema.Array(NonEmpty),
  radiusRoles: Schema.Array(NonEmpty),
  layerRoles: Schema.Array(NonEmpty),
  motionRoles: Schema.Array(NonEmpty),
  transitionChannels: Schema.Array(NonEmpty),
});

const UiCompositionSchema = Schema.Struct({
  schema: Schema.Literal("contract.ui-composition/v1"),
  id: NonEmpty,
  name: NonEmpty,
  humanProjectionContractRef: NonEmpty,
  authority: Schema.Literal("none"),
  vocabulary: VocabularySchema,
  fallbackProjection: NonEmpty,
  laws: Schema.Array(LawSchema),
  prohibitions: Schema.Array(NonEmpty),
});

export interface UiCompositionLaw {
  readonly id: string;
  readonly rule: string;
  readonly verificationClasses: readonly string[];
}

export interface UiCompositionVocabulary {
  readonly semanticRoles: readonly string[];
  readonly layoutPrimitives: readonly string[];
  readonly projectionKinds: readonly string[];
  readonly priorityLevels: readonly string[];
  readonly densityLevels: readonly string[];
  readonly viewportClasses: readonly string[];
  readonly splitRatios: readonly string[];
  readonly collapseModes: readonly string[];
  readonly spaceRoles: readonly string[];
  readonly surfaceRoles: readonly string[];
  readonly toneRoles: readonly string[];
  readonly radiusRoles: readonly string[];
  readonly layerRoles: readonly string[];
  readonly motionRoles: readonly string[];
  readonly transitionChannels: readonly string[];
}

export interface UiCompositionContract {
  readonly schema: "contract.ui-composition/v1";
  readonly id: string;
  readonly name: string;
  readonly humanProjectionContractRef: string;
  readonly authority: "none";
  readonly vocabulary: UiCompositionVocabulary;
  readonly fallbackProjection: string;
  readonly laws: readonly UiCompositionLaw[];
  readonly prohibitions: readonly string[];
}

export type UiCompositionContractResult =
  | { readonly _tag: "UiCompositionContract"; readonly contract: UiCompositionContract }
  | {
      readonly _tag: "Refusal";
      readonly reason:
        | "invalid-ui-composition-contract"
        | "ui-vocabulary-drift"
        | "duplicate-ui-law"
        | "duplicate-ui-verification-class"
        | "duplicate-ui-prohibition"
        | "invalid-fallback-projection";
    };

const DEFAULT_UI_COMPOSITION_CONTRACT: unknown = {
  "schema": "contract.ui-composition/v1",
  "id": "ui-composition-v1",
  "name": "generic-deterministic-composition",
  "humanProjectionContractRef": "human-projection-v1",
  "authority": "none",
  "vocabulary": {
    "semanticRoles": [
      "entity",
      "collection",
      "metric",
      "status",
      "action",
      "evidence",
      "temporal-sequence",
      "relationship",
      "artifact",
      "conversation",
      "document"
    ],
    "layoutPrimitives": [
      "stack",
      "inline",
      "grid",
      "split",
      "pane",
      "overlay",
      "dock",
      "canvas"
    ],
    "projectionKinds": [
      "document",
      "collection",
      "table",
      "timeline",
      "graph",
      "metric",
      "inspector",
      "artifact",
      "evidence",
      "status"
    ],
    "priorityLevels": [
      "primary",
      "secondary",
      "supporting",
      "metadata"
    ],
    "densityLevels": [
      "compact",
      "standard",
      "comfortable"
    ],
    "viewportClasses": [
      "compact",
      "medium",
      "wide"
    ],
    "splitRatios": [
      "equal",
      "primary-secondary",
      "secondary-primary"
    ],
    "collapseModes": [
      "none",
      "secondary",
      "primary",
      "overlay-secondary"
    ],
    "spaceRoles": [
      "none",
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl"
    ],
    "surfaceRoles": [
      "base",
      "subtle",
      "raised",
      "overlay"
    ],
    "toneRoles": [
      "neutral",
      "accent",
      "info",
      "positive",
      "warning",
      "negative"
    ],
    "radiusRoles": [
      "none",
      "control",
      "surface",
      "overlay",
      "round"
    ],
    "layerRoles": [
      "base",
      "raised",
      "sticky",
      "overlay",
      "popover",
      "modal",
      "toast",
      "drag",
      "system"
    ],
    "motionRoles": [
      "none",
      "micro",
      "layout",
      "projection",
      "overlay",
      "shared"
    ],
    "transitionChannels": [
      "position",
      "size",
      "opacity",
      "color",
      "radius",
      "transform",
      "clip",
      "layer"
    ]
  },
  "fallbackProjection": "inspector",
  "laws": [
    {
      "id": "composition-is-declarative-state",
      "rule": "A UI composition is a validated declarative state tree. Changes produce a new tree and a deterministic transition plan; imperative DOM placement and animation instructions are renderer internals.",
      "verificationClasses": [
        "schema",
        "conformance"
      ]
    },
    {
      "id": "planner-selects-semantics-not-pixels",
      "rule": "A model or planner may select declared semantic roles, projections, priority, density and composition relationships, but arbitrary pixel coordinates, raw spacing values, raw colors and unbounded geometry are renderer-owned.",
      "verificationClasses": [
        "schema",
        "conformance"
      ]
    },
    {
      "id": "composition-is-deterministic",
      "rule": "The same validated UI composition input, design-system version, viewport class and theme/profile inputs must resolve to the same composition result.",
      "verificationClasses": [
        "conformance",
        "golden-render"
      ]
    },
    {
      "id": "layout-vocabulary-is-closed",
      "rule": "General UI composition uses only declared layout primitives; absolute freeform placement is reserved for an explicit canvas or domain viewport.",
      "verificationClasses": [
        "schema",
        "conformance"
      ]
    },
    {
      "id": "visual-values-are-tokenized",
      "rule": "Spacing, surface, tone, radius and motion choices reference declared semantic roles. Raw visual values remain design-system implementation details.",
      "verificationClasses": [
        "schema",
        "conformance"
      ]
    },
    {
      "id": "z-order-is-semantic",
      "rule": "Stacking order uses the declared layer roles. Raw z-index integers are renderer-owned and product compositions cannot invent or numerically compare z values.",
      "verificationClasses": [
        "schema",
        "conformance",
        "golden-render"
      ]
    },
    {
      "id": "layer-changes-are-discrete",
      "rule": "A semantic z-layer change is a discrete ordering transition, not interpolation of a z-index number. Enter/exit ordering is selected deterministically by the renderer transition policy.",
      "verificationClasses": [
        "conformance",
        "golden-render"
      ]
    },
    {
      "id": "layout-motion-preserves-source-geometry",
      "rule": "Position and size changes are expressed as layout transitions between resolved states; web realizations should prefer transform-based layout projection or an equivalent mechanism over frame-by-frame top/left/width/height animation.",
      "verificationClasses": [
        "platform-conformance",
        "golden-render"
      ]
    },
    {
      "id": "token-switches-may-interpolate",
      "rule": "Color, radius, opacity and other compatible token changes may interpolate through a declared transition channel while preserving the exact semantic before/after state.",
      "verificationClasses": [
        "platform-conformance",
        "golden-render"
      ]
    },
    {
      "id": "motion-is-interruptible-where-possible",
      "rule": "Interactive layout, projection and overlay transitions should be interruptible or reversible when the realization supports it; animation completion never becomes semantic completion.",
      "verificationClasses": [
        "platform-conformance",
        "human-scenario"
      ]
    },
    {
      "id": "reduced-motion-preserves-meaning",
      "rule": "Reduced-motion realizations may remove spatial choreography but must preserve state, hierarchy, ordering, focus, feedback and transition meaning.",
      "verificationClasses": [
        "platform-conformance",
        "human-scenario"
      ]
    },
    {
      "id": "projection-does-not-own-truth",
      "rule": "Changing projection, layout, density, ordering or presentation context cannot rewrite the semantic identity, authority or provenance of the projected source.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "one-source-may-have-many-projections",
      "rule": "The same semantic source may be represented through multiple declared projections when each preserves source identity and material state.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "responsive-behavior-is-rule-driven",
      "rule": "Responsive composition changes are selected from declared viewport classes, split ratios and collapse modes rather than ad hoc model-generated geometry.",
      "verificationClasses": [
        "conformance",
        "golden-render"
      ]
    },
    {
      "id": "generic-fallback-is-required",
      "rule": "A valid unknown or newly introduced semantic object remains inspectable through the declared fallback projection before product-specific UI exists.",
      "verificationClasses": [
        "conformance",
        "human-scenario"
      ]
    },
    {
      "id": "renderer-is-replaceable",
      "rule": "React, StyleX, Astryx, SwiftUI, WinUI, HTML, Tauri or another renderer may realize the same validated composition without entering semantic identity.",
      "verificationClasses": [
        "platform-conformance"
      ]
    },
    {
      "id": "interaction-semantics-survive-renderers",
      "rule": "Focus, action meaning, status, recovery and accessibility-equivalent operation remain semantically equivalent across renderer and input mechanisms.",
      "verificationClasses": [
        "platform-conformance",
        "human-scenario"
      ]
    },
    {
      "id": "product-profiles-specialize",
      "rule": "Product-specific profiles bind navigation, patterns, preferred projections, visual identity and domain widgets downstream of this generic grammar without silently widening semantic authority.",
      "verificationClasses": [
        "schema",
        "conformance"
      ]
    }
  ],
  "prohibitions": [
    "no product-specific navigation in the generic profile",
    "no product-specific visual theme in the generic profile",
    "no renderer dependency in the generic profile",
    "no arbitrary pixel placement outside explicit canvas or domain viewports",
    "no raw model-authored spacing, color, radius, z-index or animation values",
    "no imperative animation commands in semantic composition",
    "no projection-generated semantic or effect authority"
  ]
};
const DEFAULT_VOCABULARY = {
  "semanticRoles": [
    "entity",
    "collection",
    "metric",
    "status",
    "action",
    "evidence",
    "temporal-sequence",
    "relationship",
    "artifact",
    "conversation",
    "document"
  ],
  "layoutPrimitives": [
    "stack",
    "inline",
    "grid",
    "split",
    "pane",
    "overlay",
    "dock",
    "canvas"
  ],
  "projectionKinds": [
    "document",
    "collection",
    "table",
    "timeline",
    "graph",
    "metric",
    "inspector",
    "artifact",
    "evidence",
    "status"
  ],
  "priorityLevels": [
    "primary",
    "secondary",
    "supporting",
    "metadata"
  ],
  "densityLevels": [
    "compact",
    "standard",
    "comfortable"
  ],
  "viewportClasses": [
    "compact",
    "medium",
    "wide"
  ],
  "splitRatios": [
    "equal",
    "primary-secondary",
    "secondary-primary"
  ],
  "collapseModes": [
    "none",
    "secondary",
    "primary",
    "overlay-secondary"
  ],
  "spaceRoles": [
    "none",
    "xs",
    "sm",
    "md",
    "lg",
    "xl",
    "2xl"
  ],
  "surfaceRoles": [
    "base",
    "subtle",
    "raised",
    "overlay"
  ],
  "toneRoles": [
    "neutral",
    "accent",
    "info",
    "positive",
    "warning",
    "negative"
  ],
  "radiusRoles": [
    "none",
    "control",
    "surface",
    "overlay",
    "round"
  ],
  "layerRoles": [
    "base",
    "raised",
    "sticky",
    "overlay",
    "popover",
    "modal",
    "toast",
    "drag",
    "system"
  ],
  "motionRoles": [
    "none",
    "micro",
    "layout",
    "projection",
    "overlay",
    "shared"
  ],
  "transitionChannels": [
    "position",
    "size",
    "opacity",
    "color",
    "radius",
    "transform",
    "clip",
    "layer"
  ]
} as const;

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function compileUiCompositionContract(
  input: unknown = DEFAULT_UI_COMPOSITION_CONTRACT,
): UiCompositionContractResult {
  const decoded = decodeStrict(UiCompositionSchema, input);
  if (
    decoded === null ||
    decoded.laws.length === 0 ||
    decoded.prohibitions.length === 0
  ) {
    return { _tag: "Refusal", reason: "invalid-ui-composition-contract" };
  }

  for (const key of Object.keys(DEFAULT_VOCABULARY) as Array<keyof typeof DEFAULT_VOCABULARY>) {
    if (!sameList(decoded.vocabulary[key], DEFAULT_VOCABULARY[key])) {
      return { _tag: "Refusal", reason: "ui-vocabulary-drift" };
    }
  }

  if (!decoded.vocabulary.projectionKinds.includes(decoded.fallbackProjection)) {
    return { _tag: "Refusal", reason: "invalid-fallback-projection" };
  }
  if (hasDuplicates(decoded.laws.map((law) => law.id))) {
    return { _tag: "Refusal", reason: "duplicate-ui-law" };
  }
  if (decoded.laws.some((law) => hasDuplicates(law.verificationClasses))) {
    return { _tag: "Refusal", reason: "duplicate-ui-verification-class" };
  }
  if (hasDuplicates(decoded.prohibitions)) {
    return { _tag: "Refusal", reason: "duplicate-ui-prohibition" };
  }

  const normalizedVocabulary = Object.fromEntries(
    Object.entries(decoded.vocabulary).map(([key, value]) => [key, Object.freeze([...value])]),
  ) as unknown as UiCompositionVocabulary;

  return {
    _tag: "UiCompositionContract",
    contract: Object.freeze({
      schema: "contract.ui-composition/v1",
      id: decoded.id,
      name: decoded.name,
      humanProjectionContractRef: decoded.humanProjectionContractRef,
      authority: "none",
      vocabulary: Object.freeze(normalizedVocabulary),
      fallbackProjection: decoded.fallbackProjection,
      laws: Object.freeze(
        [...decoded.laws]
          .map((law) =>
            Object.freeze({
              id: law.id,
              rule: law.rule,
              verificationClasses: Object.freeze(sortedUnique(law.verificationClasses)),
            }),
          )
          .sort((a, b) => compareText(a.id, b.id)),
      ),
      prohibitions: Object.freeze([...decoded.prohibitions]),
    }),
  };
}
