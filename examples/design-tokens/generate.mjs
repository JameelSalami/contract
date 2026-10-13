#!/usr/bin/env node
/**
 * Real document -> typed Contract projection -> generated CSS with a drift gate.
 * Run `npm run build` first; then:
 * node examples/design-tokens/generate.mjs [--check] [--input DESIGN.md] [--out tokens.css]
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileDesignSource, compileDesignSourceBinding, projectDocuments
} from "../../src/index.ts";

const directory = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const getArg = (flag, defaultValue) => {
  const index = args.indexOf(flag);
  if (index < 0) return defaultValue;
  if (index === args.length - 1) throw Error("missing value for " + flag);
  return resolve(args[index + 1]);
};
const sourcePath = getArg("--input", resolve(directory, "DESIGN.sample.txt"));
const cssPath = getArg("--out", resolve(directory, "tokens.css"));
const bindingPath = cssPath + ".binding.json";

const designText = await readFile(sourcePath, "utf8");
const compiled = compileDesignSource({ kind: "design-md", path: "DESIGN.md", content: designText });
if (compiled._tag !== "DesignSourceProjection") {
  throw Error("Refused design: " + compiled.reason);
}
const binding = compileDesignSourceBinding({
  id: "demo-design-token-output",
  source: compiled.projection,
  humanProjectionContractRef: "design-provenance/v1",
  uiCompositionContractRef: "css-custom-properties/v1",
  acceptanceContractRef: "test:generated-token-drift",
  authority: "none"
});
if (binding._tag !== "DesignSourceBinding") {
  throw Error("Refused design binding: " + binding.reason);
}
const validName = /^[a-z][a-z0-9-]*$/;
const validValue = /^[-\w#().,%\s]+$/;
const variables = [];
for (const [category, tokens] of [
  ["color", compiled.projection.tokens.colors],
  ["space", compiled.projection.tokens.spacing],
  ["radius", compiled.projection.tokens.rounded]
]) {
  for (const [name, value] of Object.entries(tokens).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!validName.test(name) || !validValue.test(String(value))) {
      throw Error("Refusing unsafe CSS token: " + category + "/" + name);
    }
    variables.push("  --" + category + "-" + name + ": " + value + ";");
  }
}
const projected = projectDocuments({
  source: { ref: compiled.projection.source.ref, digest: compiled.projection.source.digest },
  adapter: {
    id: "example.css-token-compiler",
    version: "1",
    render: () => [{
      ref: "css:design-tokens",
      kind: "stylesheet",
      path: "tokens.css",
      mediaType: "text/css",
      content: [":root {", ...variables, "}", ""].join("\n")
    }]
  },
  input: compiled.projection.tokens
});
if (projected._tag !== "DocumentProjection") {
  throw Error("Refused CSS projection: " + projected.reason);
}
const css = projected.projection.files[0].content;
const metadata = JSON.stringify({
  sourceDigest: binding.binding.sourceDigest,
  sourceProjectionDigest: binding.binding.sourceProjectionDigest,
  bindingDigest: binding.binding.digest,
  outputDigest: projected.projection.files[0].digest,
  authority: "none"
}, null, 2) + "\n";

if (check) {
  let oldCss, oldBinding;
  try {
    [oldCss, oldBinding] = await Promise.all([readFile(cssPath, "utf8"), readFile(bindingPath, "utf8")]);
  } catch {
    console.error("DRIFT: generated CSS or provenance file missing");
    process.exitCode = 1;
  }
  if (oldCss !== undefined && oldBinding !== undefined) {
    if (oldCss !== css || oldBinding !== metadata) {
      console.error("DRIFT: the current DESIGN.md no longer matches its generated CSS/provenance");
      process.exitCode = 1;
    } else console.log("PASS: DESIGN.md, generated CSS and provenance are current");
  }
} else {
  await writeFile(cssPath, css);
  await writeFile(bindingPath, metadata);
  console.log("Generated CSS from typed DESIGN.md with source and output digests");
}
