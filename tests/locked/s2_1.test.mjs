// LOCKED test for S2.1 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { markDone } from "../../src/update.mjs";
import { parsePlan } from "../../src/parse.mjs";

test("checks the box of the given step only", () => {
  const before = "# P\n- [ ] S1.1 A\n- [ ] S1.2 B\n";
  assert.equal(markDone(before, "S1.2"), "# P\n- [ ] S1.1 A\n- [x] S1.2 B\n");
});

test("keeps CRLF and every other byte", () => {
  const before = "intro\r\n* [ ] S2.1 Keep  spacing \r\n- [ ] S2.2 Other\r\n";
  assert.equal(markDone(before, "S2.1"), "intro\r\n* [x] S2.1 Keep  spacing \r\n- [ ] S2.2 Other\r\n");
});

test("already done returns the same text", () => {
  const text = "- [X] S1.1 A\n";
  assert.equal(markDone(text, "S1.1"), text);
});

test("does not touch indented lines with the same id", () => {
  const before = "  - [ ] S1.1 note\n- [ ] S1.1 Real\n";
  assert.equal(markDone(before, "S1.1"), "  - [ ] S1.1 note\n- [x] S1.1 Real\n");
});

test("same step-line rule as parsePlan: any whitespace around the id", () => {
  const before = "- [ ]   S1.1  Spaced\n* [ ]\tS1.2\tTabbed\n";
  assert.deepEqual(parsePlan(before).map(s => s.id), ["S1.1", "S1.2"]);
  const once = markDone(before, "S1.1");
  assert.equal(once, "- [x]   S1.1  Spaced\n* [ ]\tS1.2\tTabbed\n");
  assert.equal(markDone(once, "S1.2"), "- [x]   S1.1  Spaced\n* [x]\tS1.2\tTabbed\n");
});

test("a [ ] inside the title of a done step is never touched", () => {
  const text = "- [x] S1.1 Fix the [ ] box\n";
  assert.equal(markDone(text, "S1.1"), text);
  assert.equal(markDone("- [ ] S1.1 Fix the [ ] box\n", "S1.1"), "- [x] S1.1 Fix the [ ] box\n");
});

test("unknown id throws", () => {
  assert.throws(() => markDone("- [ ] S1.1 A\n", "S9.9"), /unknown step/i);
});
