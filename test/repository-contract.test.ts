import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import * as api from "../src/index.js";
import { compileRepositoryContract } from "../src/repository-contract.js";

const root = new URL("../", import.meta.url);

async function markdownFiles(path: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(path)) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const full = join(path, name);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...await markdownFiles(full));
    else if (name.toLowerCase().endsWith(".md")) out.push(full);
  }
  return out;
}

test("repository is governed by its own closed contract", async () => {
  const source = JSON.parse(await readFile(new URL("../contract.json", import.meta.url), "utf8"));
  const result = compileRepositoryContract(source);
  assert.equal(result._tag, "RepositoryContract");
  if (result._tag !== "RepositoryContract") return;

  assert.equal(result.contract.package.name, "contract");
  assert.equal(result.contract.implementation.effect, "required");
  assert.equal(result.contract.implementation.xstate, "optional-not-core");
  assert.equal(result.contract.rules.markdownDocs, "forbidden");

  for (const module of result.contract.modules) {
    await stat(new URL("../" + module.source, import.meta.url));
    for (const name of module.exports) {
      assert.equal(typeof (api as Record<string, unknown>)[name], "function", module.id + " missing export " + name);
    }
  }
});

// The public npm/GitHub README is a distribution artifact, not an internal
// machine-governed Markdown contract. All other source Markdown remains forbidden.
test("repository permits only the root release README and no XState dependency", async () => {
  const files = await markdownFiles(root.pathname);
  assert.deepEqual(files, [join(root.pathname, "README.md")]);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies?.xstate, undefined);
  assert.equal(pkg.devDependencies?.xstate, undefined);
});

test("governance rejects unknown fields and mandatory XState", async () => {
  const source = JSON.parse(await readFile(new URL("../contract.json", import.meta.url), "utf8"));
  assert.equal(compileRepositoryContract({ ...source, mystery: true })._tag, "Refusal");
  assert.equal(
    compileRepositoryContract({
      ...source,
      implementation: { ...source.implementation, xstate: "required" }
    })._tag,
    "Refusal"
  );
});
