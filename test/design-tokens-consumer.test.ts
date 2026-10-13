import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("document-to-CSS consumer emits a verifiable design binding and detects document drift", () => {
  const root = mkdtempSync(join(tmpdir(), "contract-css-consumer-"));
  const cli = resolve("examples/design-tokens/generate.mjs");
  const input = join(root,"DESIGN.md");
  const out = join(root,"tokens.css");
  const template = readFileSync(resolve("examples/design-tokens/DESIGN.sample.txt"),"utf8");
  writeFileSync(input, template);
  const run = (...args: string[]) => spawnSync(process.execPath, [
    "--import", "tsx", cli, "--input",input,"--out",out, ...args
  ], { encoding: "utf8" });
  const generated=run();
  assert.equal(generated.status,0,generated.stderr);
  assert.match(readFileSync(out,"utf8"),/--color-primary: #243657/);
  const provenance = JSON.parse(readFileSync(out+".binding.json","utf8"));
  assert.match(provenance.sourceDigest,/^sha256:[a-f0-9]{64}$/);
  assert.match(provenance.bindingDigest,/^sha256:[a-f0-9]{64}$/);
  const accepted=run("--check");
  assert.equal(accepted.status,0,accepted.stderr);
  writeFileSync(input, template.replace("#243657","#203351"));
  const drift=run("--check");
  assert.notEqual(drift.status,0);
  assert.match(drift.stderr,/DRIFT/);
  const updated=run();
  assert.equal(updated.status,0,updated.stderr);
  assert.equal(run("--check").status,0);
});
