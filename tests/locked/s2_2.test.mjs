// LOCKED test for S2.2 — agents must not edit this file (hash in tests/LOCKED.sha256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { summary } from "../../src/summary.mjs";

const s = (done) => ({ id: "S1.1", title: "t", done });

test("counts done and pending, floors the percent", () => {
  assert.deepEqual(summary([s(true), s(true), s(false)]), { total: 3, done: 2, pending: 1, percent: 66 });
});

test("all done is 100", () => {
  assert.deepEqual(summary([s(true)]), { total: 1, done: 1, pending: 0, percent: 100 });
});

test("empty list is 0 percent", () => {
  assert.deepEqual(summary([]), { total: 0, done: 0, pending: 0, percent: 0 });
});
