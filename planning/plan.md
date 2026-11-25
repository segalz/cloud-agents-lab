# Plan: `plan-tracker` (cloud agent experiment)

## Why this repository exists

This is a live experiment. Free coding agents run on GitHub Actions and build a small real tool step by step:

- **Writer:** OpenCode, through the `openCodeHelperMcp` bridge (`apply_opencode_edits`).
- **Reviewer:** Cline, through the `ClineMcp` bridge (`ask_cline_workspace`).
- **Supervisor:** `runner/supervisor.mjs` for now. Later it will be Hermes, or another agent such as Dots.

The goal is to learn exactly what the instructions for Hermes or Dots must say. What we learn is recorded in `planning/log.md`, `planning/runs.jsonl` and `planning/lessons.md`.

## Product

`plan-tracker` is a zero-dependency Node.js (>= 22, ESM) library and CLI. It reads a Markdown checklist plan and answers three things:

- the next step;
- the progress;
- marking a step done.

A later Hermes skill can use it to track plans like this one.

### Step-line format (shared by every step)

A **step line** must meet all of these:

- it starts at column 0 with `- ` or `* `;
- then a checkbox: `[ ]` (pending) or `[x]` / `[X]` (done);
- then whitespace, a step id matching `S<digits>.<digits>`, and whitespace;
- then the title, which is the rest of the line, trimmed.

The following are **not** step lines and are ignored:

- indented lines;
- checkboxes without a valid id;
- checkboxes in the middle of a line.

Both LF and CRLF line endings are supported.

## Rules for every step

- Only the files listed under "Files allowed" may change. Never touch `tests/`, `planning/`, `runner/`, `.github/`, or `package.json`.
- No new dependencies. Use Node.js built-ins only.
- Every step is checked by its locked test file. The supervisor also re-runs the tests of all earlier finished steps.

---

## Stage 1: Parsing

### S1.1 Parse checklist steps
- **Goal:** add `parsePlan(text)` to `src/parse.mjs`. It returns an array of `{ id, title, done }` in file order, using the step-line format above.
- **Acceptance:**
  - `parsePlan("")` returns `[]`.
  - Duplicate ids throw an `Error` whose message contains `duplicate`.
  - CRLF input works.
- **Files allowed:** `src/parse.mjs`
- **Verify:** `node --test tests/locked/s1_1.test.mjs`

### S1.2 Find the next step
- **Goal:** add `nextStep(steps)` to `src/parse.mjs`. It returns the first step with `done === false`. If all steps are done, or the array is empty, it returns `null`.
- **Acceptance:**
  - A non-array argument throws a `TypeError`.
  - `parsePlan` keeps working.
- **Files allowed:** `src/parse.mjs`
- **Verify:** `node --test tests/locked/s1_2.test.mjs`

## Stage 2: Updating and summarising

### S2.1 Mark a step done
- **Goal:** create `src/update.mjs` exporting `markDone(text, id)`. It returns the text with that step line's checkbox set to `[x]`.
- **Acceptance:**
  - Every other byte stays unchanged, CRLF included.
  - A step that is already done returns the text unchanged.
  - An unknown id throws an `Error` whose message contains `unknown step`.
  - Indented lines that mention the same id are never changed.
- **Files allowed:** `src/update.mjs`, `src/parse.mjs`
- **Verify:** `node --test tests/locked/s2_1.test.mjs`

### S2.2 Summary numbers
- **Goal:** create `src/summary.mjs` exporting `summary(steps)`, which returns `{ total, done, pending, percent }`.
- **Acceptance:**
  - `percent` is `Math.floor(done * 100 / total)`, and `0` when `total` is `0`.
- **Files allowed:** `src/summary.mjs`
- **Verify:** `node --test tests/locked/s2_2.test.mjs`

## Stage 3: Command line

### S3.1 `next` command
- **Goal:** create `bin/plan-tracker.mjs`, runnable as `node bin/plan-tracker.mjs next <file>`.
- **Acceptance:**
  - It prints `<id> <title>\n` for the next step and exits `0`.
  - When all steps are done, it prints `all steps done\n` and exits `3`.
  - When the file cannot be read, it writes a message containing `cannot read` to stderr and exits `2`.
  - With no command, or an unknown command, it writes a usage line starting with `usage:` to stderr and exits `2`.
- **Files allowed:** `bin/plan-tracker.mjs`, `src/parse.mjs`
- **Verify:** `node --test tests/locked/s3_1.test.mjs`

### S3.2 `status` and `done` commands
- **Goal:** add two commands to `bin/plan-tracker.mjs`:
  - `status <file>` prints `<done>/<total> done (<percent>%)\n` and exits `0`.
  - `done <file> <id>` marks the step done in the file itself, prints `marked <id> done\n` and exits `0`.
- **Acceptance:**
  - An unknown id leaves the file unchanged, writes a message containing `unknown step` to stderr, and exits `1`.
  - `next` keeps working.
- **Files allowed:** `bin/plan-tracker.mjs`, `src/update.mjs`, `src/summary.mjs`, `src/parse.mjs`
- **Verify:** `node --test tests/locked/s3_2.test.mjs`
