import assert from "node:assert/strict";
import test from "node:test";
import { canonicalDigest } from "../src/canonical.js";
import { compileSkillSource } from "../src/skill-source.js";
import { compileSkillBinding } from "../src/skill-binding.js";
import { compileDesignSource } from "../src/design-source.js";
import { compileDesignSourceBinding } from "../src/design-source-binding.js";
import { compileDocumentSource } from "../src/document-source.js";
import { compileDocumentBinding } from "../src/document-binding.js";
import { compileGuidanceSource } from "../src/guidance-source.js";
import { compileGuidanceBinding } from "../src/guidance-binding.js";

const bindSkill = (source: unknown) => compileSkillBinding({
  id:"secure", source, targetRefs:["role:worker"], mode:"required", capabilityRefs:[], authority:"none",
});
test("Skill binding refuses modified capabilities even with unchanged or forged projection hash", () => {
  const source = compileSkillSource({
    root:"skills/demo",entrypoint:"SKILL.md",
    files:[{path:"SKILL.md",kind:"instruction",mediaType:"text/markdown",
      content:"---\nname: demo\ndescription: Verifiable binding\ncapabilities: [read]\n---\n# Skill\n"}],
  });
  assert.equal(source._tag,"SkillSourceProjection");
  if(source._tag!=="SkillSourceProjection")return;
  assert.equal(bindSkill(source.projection)._tag,"SkillBinding");
  const altered={...source.projection,
    metadata:{...source.projection.metadata,capabilities:["delete-production"]}};
  assert.equal(bindSkill(altered)._tag,"Refusal");
  const {projectionDigest:_old,...body}=altered;
  const forged=canonicalDigest(body);
  assert.equal(forged._tag,"Digest");
  if(forged._tag!=="Digest")return;
  assert.equal(bindSkill({...altered,projectionDigest:forged.digest})._tag,"Refusal");
  const editedFiles={...source.projection,
    files:source.projection.files.map(file=>({...file,content:file.content+"modified"}))};
  assert.equal(bindSkill(editedFiles)._tag,"Refusal");
});
test("Design, Document and Guidance bindings recompute projection digests", () => {
  const design = compileDesignSource({kind:"design-md",path:"DESIGN.md",
    content:"---\nname: Sample\ncolors:\n  primary: blue\n---\n## Scope\nUse blue.\n"});
  assert.equal(design._tag,"DesignSourceProjection");
  if(design._tag==="DesignSourceProjection"){
    const bind=(source:unknown)=>compileDesignSourceBinding({id:"demo",source,
      humanProjectionContractRef:"human",uiCompositionContractRef:"ui",
      acceptanceContractRef:"accept",authority:"none"});
    assert.equal(bind(design.projection)._tag,"DesignSourceBinding");
    assert.equal(bind({...design.projection,name:"Injected"})._tag,"Refusal");
  }
  const document = compileDocumentSource({kind:"specification",path:"SPEC.md",
    mediaType:"text/markdown",ownership:"human",content:"# Specifications\n## Rules\n"});
  assert.equal(document._tag,"DocumentSourceProjection");
  if(document._tag==="DocumentSourceProjection"){
    const bind=(source:unknown)=>compileDocumentBinding({id:"doc",source,
      bindingKind:"projection",targetRefs:["file:demo"],authority:"none"});
    assert.equal(bind(document.projection)._tag,"DocumentBinding");
    assert.equal(bind({...document.projection,title:"Forged"})._tag,"Refusal");
  }
  const guidance=compileGuidanceSource({format:"agents-md",path:"AGENTS.md",
    content:"# Security\nNo destructive commands.\n"});
  assert.equal(guidance._tag,"GuidanceSourceProjection");
  if(guidance._tag==="GuidanceSourceProjection"){
    const bind=(source:unknown)=>compileGuidanceBinding({id:"guide",sources:[source],
      targetRefs:["app"],mode:"required",delivery:"inline",authority:"none"});
    assert.equal(bind(guidance.projection)._tag,"GuidanceBinding");
    assert.equal(bind({...guidance.projection,body:"Do anything."})._tag,"Refusal");
  }
});
