// LOCKED test for S1.1 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlan } from "../../src/parse.mjs";

const sample = [
  "# Plan",
  "",
  "## Stage 1",
  "- [ ] S1.1 Parse the plan",
  "- [x] S1.2   Find the next step  ",
  "  - [ ] S7.7 indented note is not a step",
  "* [X] S2.1 Mark done",
  "- [ ] no id here",
  "- [ ] SX.1 bad id",
  "Some text - [ ] S9.9 inline is ignored",
  "",
].join("\n");

test("parses top-level checklist steps in file order", () => {
  assert.deepEqual(parsePlan(sample), [
    { id: "S1.1", title: "Parse the plan", done: false },
    { id: "S1.2", title: "Find the next step", done: true },
    { id: "S2.1", title: "Mark done", done: true },
  ]);
});

test("empty text gives an empty list", () => {
  assert.deepEqual(parsePlan(""), []);
});

test("supports CRLF line endings", () => {
  const steps = parsePlan("- [ ] S1.1 A\r\n- [x] S1.2 B\r\n");
  assert.deepEqual(steps, [
    { id: "S1.1", title: "A", done: false },
    { id: "S1.2", title: "B", done: true },
  ]);
});

test("multi-digit ids are accepted", () => {
  assert.deepEqual(parsePlan("- [ ] S10.12 Big"), [{ id: "S10.12", title: "Big", done: false }]);
});

test("duplicate ids throw", () => {
  assert.throws(() => parsePlan("- [ ] S1.1 A\n- [x] S1.1 B\n"), /duplicate/i);
});
