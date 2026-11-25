// LOCKED test for S3.2 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "plan-tracker.mjs");
const dir = mkdtempSync(path.join(tmpdir(), "pt-s32-"));
const file = (name, text) => { const p = path.join(dir, name); writeFileSync(p, text); return p; };
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: "utf8" });

test("status prints done/total and percent", () => {
  const r = run("status", file("s.md", "- [x] S1.1 A\n- [x] S1.2 B\n- [ ] S1.3 C\n"));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "2/3 done (66%)\n");
});

test("done marks the step in the file", () => {
  const p = file("d.md", "# P\r\n- [ ] S1.1 A\r\n- [ ] S1.2 B\r\n");
  const r = run("done", p, "S1.1");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "marked S1.1 done\n");
  assert.equal(readFileSync(p, "utf8"), "# P\r\n- [x] S1.1 A\r\n- [ ] S1.2 B\r\n");
});

test("done with an unknown id exits 1 and keeps the file", () => {
  const text = "- [ ] S1.1 A\n";
  const p = file("u.md", text);
  const r = run("done", p, "S4.4");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown step/i);
  assert.equal(readFileSync(p, "utf8"), text);
});

test("next still works", () => {
  const r = run("next", file("n.md", "- [ ] S1.1 A\n"));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "S1.1 A\n");
});
