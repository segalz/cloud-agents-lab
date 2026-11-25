// LOCKED test for S3.1 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "plan-tracker.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "pt-s31-"));
const file = (name, text) => { const p = path.join(dir, name); writeFileSync(p, text); return p; };
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

test("next prints the next step", () => {
  const r = run("next", file("a.md", "- [x] S1.1 A\n- [ ] S1.2 Second one\n"));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "S1.2 Second one\n");
});

test("next exits 3 when all done", () => {
  const r = run("next", file("b.md", "- [x] S1.1 A\n"));
  assert.equal(r.status, 3);
  assert.equal(r.stdout, "all steps done\n");
});

test("missing file exits 2 with cannot read", () => {
  const r = run("next", path.join(dir, "missing.md"));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot read/i);
});

test("no or unknown command prints usage and exits 2", () => {
  for (const args of [[], ["fly", "x.md"]]) {
    const r = run(...args);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /^usage:/m);
  }
});
