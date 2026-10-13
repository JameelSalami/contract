export { compileRepositoryContract } from "./repository-contract.js";
export { canonicalDigest } from "./canonical.js";
export { contentDigest } from "./content-identity.js";
export { compileReceipt } from "./compile-receipt.js";
export { compileArtifactManifest } from "./artifact-manifest.js";
export { calculateChangeImpact } from "./dependency-impact.js";
export { compileVerificationReceipt } from "./verification-receipt.js";
export { observeArtifactDrift } from "./artifact-drift.js";
export { runConformance } from "./conformance.js";
export { compileChangeCandidate } from "./change-candidate.js";
export { observeDecisionBoundaryDrift } from "./decision-boundary.js";
export { projectDocuments } from "./document-adapter.js";
export { compileDeepModuleContract } from "./deep-module-contract.js";
export { compileEngineeringDoctrineContract } from "./engineering-doctrine-contract.js";
export { compileVerificationContract } from "./verification-contract.js";
export { compileTestContract } from "./test-contract.js";
export { compileHumanProjectionContract } from "./human-projection-contract.js";
export { compileUiCompositionContract } from "./ui-composition-contract.js";
export { compileDesignSource } from "./design-source.js";
export { compileDesignSourceBinding } from "./design-source-binding.js";
export { compileDocumentSource } from "./document-source.js";
export { compileDocumentBinding } from "./document-binding.js";
export { compileGuidanceSource } from "./guidance-source.js";
export { compileGuidanceBinding } from "./guidance-binding.js";
export { compileSkillSource } from "./skill-source.js";
export { compileSkillBinding } from "./skill-binding.js";

export type {
  RepositoryContract,
  RepositoryContractResult,
  RepositoryModuleContract,
} from "./repository-contract.js";
export type {
  CanonicalDigestResult,
  CanonicalRefusalReason,
} from "./canonical.js";
export type {
  CompileReceipt,
  CompileReceiptResult,
} from "./compile-receipt.js";
export type {
  ArtifactManifest,
  ArtifactManifestResult,
  ArtifactOwnership,
  ArtifactRecord,
} from "./artifact-manifest.js";
export type {
  ChangeImpact,
  ChangeImpactResult,
} from "./dependency-impact.js";
export type {
  VerificationReceipt,
  VerificationReceiptResult,
} from "./verification-receipt.js";
export type {
  ArtifactDriftEntry,
  ArtifactDriftObservation,
  ObservedArtifact,
} from "./artifact-drift.js";
export type {
  ConformanceFailure,
  ConformanceFixture,
  ConformanceObserved,
  ConformanceReport,
} from "./conformance.js";
export type {
  ChangeCandidate,
  ChangeCandidateResult,
} from "./change-candidate.js";
export type {
  DecisionBoundary,
  DecisionBoundaryDrift,
  DecisionMode,
} from "./decision-boundary.js";
export type {
  DocumentOutput,
  DocumentProjection,
  DocumentProjectionFile,
  DocumentProjectionResult,
  DocumentSource,
} from "./document-adapter.js";
export type {
  DeepModuleContract,
  DeepModuleContractResult,
} from "./deep-module-contract.js";
export type {
  EngineeringDoctrineContract,
  EngineeringDoctrineContractResult,
} from "./engineering-doctrine-contract.js";
export type {
  VerificationContract,
  VerificationContractResult,
  VerificationStage,
} from "./verification-contract.js";
export type {
  TestContract,
  TestContractRef,
  TestContractResult,
  TestEffectMode,
  TestUnknownPolicy,
} from "./test-contract.js";

export type { HumanProjectionContract, HumanProjectionContractResult, HumanProjectionLaw } from "./human-projection-contract.js";
export type { UiCompositionContract, UiCompositionContractResult, UiCompositionLaw, UiCompositionVocabulary } from "./ui-composition-contract.js";
export type { DesignSourceProjection, DesignSourceResult, DesignJson, DesignTypographyToken, DesignComponentToken } from "./design-source.js";
export type { DesignSourceBinding, DesignSourceBindingResult } from "./design-source-binding.js";
export type { DocumentSourceProjection, DocumentSourceResult } from "./document-source.js";
export type { DocumentBinding, DocumentBindingResult } from "./document-binding.js";
export type { GuidanceJson, GuidanceSourceProjection, GuidanceSourceResult } from "./guidance-source.js";
export type { GuidanceBinding, GuidanceBindingResult } from "./guidance-binding.js";
export type { SkillJson, SkillSourceProjection, SkillSourceResult } from "./skill-source.js";
export type { SkillBinding, SkillBindingResult } from "./skill-binding.js";
export { compileToolingContract } from "./tooling-contract.js";
export { compileImplementationContract } from "./implementation-contract.js";
export type { ToolingContract, ToolingContractResult } from "./tooling-contract.js";
export type { ImplementationContract, ImplementationContractResult } from "./implementation-contract.js";
export {
  compileExtensionManifest,
  discoverExtensions,
  compileExtensionBinding,
  compileExtensionTransition,
} from "./extension.js";
export type {
  ExtensionManifest, ExtensionManifestResult, ExtensionDiscoveryResult,
  ExtensionBinding, ExtensionBindingResult, ExtensionTransition, ExtensionTransitionResult,
} from "./extension.js";
