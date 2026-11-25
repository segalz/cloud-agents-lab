// LOCKED test for S2.1 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { markDone } from "../../src/update.mjs";

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

test("unknown id throws", () => {
  assert.throws(() => markDone("- [ ] S1.1 A\n", "S9.9"), /unknown step/i);
});
