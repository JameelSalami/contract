# Contract

**Contract** is an ESM-first TypeScript library for compiling, validating, and
comparing machine-readable engineering contracts. It provides deterministic
content identities, explicit refusal results, structural conformance checks,
change/verification receipts, artifact ownership and drift projections, and
declarative bindings for documents, design, guidance, skills, and extensions.

Contract is **domain-neutral**. Applications own their domain meaning, evidence,
trust policy, persistence, and execution. Contract does not discover an
authoritative source of truth, run deployment actions, approve agent proposals,
or grant permissions.

## Requirements and installation

- Node.js **20.19+** (NodeNext ESM), npm **10+** for source builds.
- TypeScript **5.9+** recommended for type consumers using NodeNext resolution.
- The planned npm identity is `@durable-systems/contract`. Until namespace approval
  and publication, install from a locally built release tarball, not from a
  nonexistent npm registry entry.

Once published:

```sh
npm install @durable-systems/contract
```

From this independent source repository:

```sh
npm ci
npm run verify             # typecheck, 68 tests, production build
npm run verify:install     # real npm pack + isolated ESM / declaration consumer
```

`npm pack` runs `prepack` (the complete verification suite) and distributes
compiled JavaScript, `.d.ts` declarations, source maps, `contract.json`,
this README, and the Apache-2.0 LICENSE. It does not require any sibling
source repository.

## Minimal working example

```ts
import {
  canonicalDigest,
  contentDigest,
  compileExtensionManifest,
  type ExtensionManifest,
} from "@durable-systems/contract";

const identity = canonicalDigest({ revision: 3, project: "example" });
if (identity._tag !== "Digest") {
  throw new Error(`Unsupported value: ${identity.reason}`);
}
console.log(identity.digest); // sha256:<64 lowercase hex digits>

console.log(contentDigest("hello")); // sha256:<64 lowercase hex digits>

const compiled = compileExtensionManifest({
  schema: "contract.extension-manifest/v1",
  id: "example.adapter",
  version: "0.1.0",
  foundation: "assurance",
  interface: { id: "example.gate", version: "1" },
  capabilities: ["inspect"],
  requiredChecks: ["conformance"],
  configurationSchemaDigest: null,
  authority: "none",
});
if (compiled._tag === "Refusal") {
  throw new Error(compiled.reason);
}
const manifest: ExtensionManifest = compiled.manifest;
console.log(manifest.digest); // an identity, NOT permission to execute code
```

With JavaScript ESM, omit the `type ExtensionManifest` import. Only the package
root export is public; `dist/internal` and source paths are not public APIs.

## Public API

All functions and types below are exported from `@durable-systems/contract`. The
corresponding `*Result`, contract/receipt, and constituent record types are
exported where defined in `src/index.ts`.

| Area | Functions | Responsibility |
| --- | --- | --- |
| Identity | `canonicalDigest`, `contentDigest` | SHA-256 identity of supported JSON values or exact UTF-8/byte content |
| Repository / architecture | `compileRepositoryContract`, `compileDeepModuleContract`, `compileEngineeringDoctrineContract`, `compileToolingContract`, `compileImplementationContract` | Validate explicit architecture and implementation claims |
| Artifacts / changes | `compileReceipt`, `compileArtifactManifest`, `calculateChangeImpact`, `compileChangeCandidate`, `observeArtifactDrift`, `observeDecisionBoundaryDrift` | Bind evidence, ownership, impact, proposals, and drift |
| Verification | `compileVerificationReceipt`, `compileVerificationContract`, `compileTestContract`, `runConformance` | Typed verification structure and fixture comparison |
| Human interfaces | `compileHumanProjectionContract`, `compileUiCompositionContract`, `projectDocuments` | Check representation and projection boundaries |
| Sources / bindings | `compileDesignSource`, `compileDesignSourceBinding`, `compileDocumentSource`, `compileDocumentBinding`, `compileGuidanceSource`, `compileGuidanceBinding`, `compileSkillSource`, `compileSkillBinding` | Compile source projections and explicit source-to-output bindings |
| Extensions | `compileExtensionManifest`, `discoverExtensions`, `compileExtensionBinding`, `compileExtensionTransition` | Declarative discovery, candidate bindings, and proposed transitions with no executable authority |

The shipped `contract.json` is a **wire-schema specimen** describing this
foundation. Its internal `package.name: "contract"` is a domain/schema
literal, **not** the npm distribution name; changing the npm scope does not
change historical wire formats or schema identifiers.

## Behavioral boundaries and limitations

- Most compilers return discriminated unions such as `{ _tag: "Refusal",
  reason }` instead of implicitly repairing malformed input; inspect
  `_tag` before using their results.
- `canonicalDigest` accepts JSON-like plain data, rejects cycles, unsafe
  numeric values, `undefined`, functions, and class instances; object keys
  are serialized in **locale-independent UTF-16 code-unit lexical order**,
  including numeric-looking and Unicode property names. This is not a claim
  of full RFC 8785 compatibility. The corrected v0.1.0 pre-npm-release
  encoding preserves the existing frozen digests, but can change hashes for
  records historically digested from Git checkouts with locale-sensitive or
  array-index-like property names; reissue those early references rather than
  treating their hashes as interchangeable. A digest is an integrity
  reference, not a signature, proof of provenance, or authorization.
- Conformance utilities compare *provided fixtures and observations*; they
  cannot establish coverage of tests that nobody supplied.
- Extension manifests do not load or run plugins, attest the integrity of a
  publisher, or authorize state changes. Consumers must authenticate sources,
  independently verify evidence, and enforce user authorization.
- Source projections do not infer domain policy from prose. Change candidates
  are descriptions, never executable change plans.
- There is no CommonJS `require` condition or guarantee of browser,
  Bun, or Deno compatibility; the primary tested target is Node.js ESM.
- Contract does **not** depend on Assurance. Assurance builds on the Contract
  digest and extension declarations; they are independently packaged.

## Project layout

`src/` contains the runtime, `test/` includes deterministic fixture tests,
`contract.json` is the source-owned wire contract, and
`.github/workflows/verify.yml` verifies an independent clone with npm's
checked-in lockfile plus a real tarball consumer.

## Licensing and responsibility

Apache License 2.0; see [LICENSE](LICENSE). This license declaration is
not an assertion of ownership or third-party clearance. Distribution should
follow a separate provenance, attribution/NOTICE, and namespace review.

## Related work, prior art and third-party attribution

The following are **informational comparisons**, not a claim that this
repository copies their code, implements their formats, or has their endorsement:

- [RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785):
  prior art for deterministic serialization and hashable JSON. Contract has
  its **own** frozen digest fixtures and normalization/key-ordering rules;
  **RFC 8785 conformance is not claimed**.
- [CUE](https://cuelang.org/docs/): declarative typed data constraints,
  validation and code generation. Contract instead compiles its own
  domain-neutral engineering/source/receipt records; it does not parse CUE.
- [in-toto Attestation Framework](https://in-toto.io/docs/specs/): artifact
  claims bound to authenticated metadata. Contract compiles structured
  receipts and content identities but **does not sign, authenticate, or
  validate in-toto attestations**.
- [Pact](https://docs.pact.io/): executable consumer/provider integration
  contract tests. Contract's engineering contracts do not replace Pact's
  provider/consumer test execution.

Separately installed **production npm dependencies** retain their own
licenses: `@noble/hashes@2.4.0` (MIT), `effect@3.22.2` (MIT), and
`yaml@2.9.1` (ISC). See the checked-in npm lockfile and each upstream
package license. These libraries are *dependencies*, not copied or bundled
source in this package's npm tarball. Informational citations are not
copyright or NOTICE compliance: the right to publish this source and any
inherited obligations must be confirmed before public distribution.
