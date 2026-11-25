// LOCKED test for S1.2 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlan, nextStep } from "../../src/parse.mjs";

test("returns the first pending step", () => {
  const steps = parsePlan("- [x] S1.1 A\n- [ ] S1.2 B\n- [ ] S1.3 C\n");
  assert.deepEqual(nextStep(steps), { id: "S1.2", title: "B", done: false });
});

test("returns null when every step is done", () => {
  assert.equal(nextStep(parsePlan("- [x] S1.1 A\n- [X] S1.2 B\n")), null);
});

test("returns null for an empty list", () => {
  assert.equal(nextStep([]), null);
});

test("throws TypeError for a non-array", () => {
  assert.throws(() => nextStep("- [ ] S1.1 A"), TypeError);
  assert.throws(() => nextStep(undefined), TypeError);
});
