# Lessons

This file turns what the runs show into instructions for Hermes or Dots.
- Part A was carried over from the bridge Linux-port project (2026-11-24/25).
- Part B is filled in from `planning/log.md` after each experiment run.

## A. Already known before this experiment

**Small steps with locked checks**
1. Small, scoped steps work. In the bridge port, 13 of 14 code steps passed on the first attempt with free models.
2. The check must prove the requirement. Lock the tests (hash file) and never let the writer edit them.
3. Plan mistakes, not executor mistakes, caused both bridge-port stops (an octal escape, and an `npm` path gap). Review the plan itself before running it.
4. Flaky tests cause false rejections. Re-run a failing check once before rejecting ("flaky first").

**Running the models**
5. Free model quotas are the real limit, not CPU:
   - `opencode/*` free models share one quota.
   - NVIDIA returns 429 under parallel load, so run at most 2 calls per provider at once.
   - On a quota or rate-limit failure, move to the next model. This is not a failed attempt.
6. Cline sees only committed HEAD (it works in a disposable worktree). Commit the candidate before asking Cline to review it.
7. The writer and reviewer must come from different routes or models, for a real second opinion.
8. A passing check from the writer's bridge is not proof. The supervisor re-runs the tests itself, including the tests of earlier steps.

**Cloud setup and safety**
9. The `freellmapi` gateway is home-LAN only, so it is unusable from GitHub's cloud.
10. Cline's free `cline` provider needs the owner's account token. This experiment uses Cline with provider `nvidia` and an API key instead, so no account token is uploaded.
11. Never trust the writer with secrets. Keys go into runtime files, the agents' environment has no tokens, and every commit is scanned.

## B. Findings from this experiment

_Filled in after each run, as dated entries. Each entry covers what happened, evidence (a log entry or run link), and the rule to add for Hermes or Dots._

### 2026-11-25: runs 1 and 2 (all 6 steps, every one on the first writer attempt)

**What the runs showed**
- **It works end to end on GitHub's free runner.**
  - Run 1 ([45640745890](https://github.com/segalz/cloud-agents-lab/actions/runs/45640745890)) did 2 steps in 3m17s in total, of which about 1 minute was job setup.
  - Run 2 ([45641457776](https://github.com/segalz/cloud-agents-lab/actions/runs/45641457776)) resumed exactly at S2.1 from `progress.md` and did 4 steps in 8m44s.
- **The writer** (`nvidia/poolside/laguna-xs-2.1` through `apply_opencode_edits`) passed all 6 steps first time:
  - 5 to 26 s each for small steps;
  - 217 s and 191k input tokens for S2.1.
  - No quota or rate-limit failures at this pace.
- **The reviewer adds real value.** Cline (`nvidia/nemotron-3.5-super-vl-120b-a12b`) found a real bug in S2.1 that the locked tests did not cover: `src/update.mjs:17` uses `line.includes("[ ]")`, so a done step whose title contains `[ ]` would get its title changed.

**What went wrong**
- **BUG (supervisor, fixed):** the verdict was missed. The bridge returned `Submission recorded (verified): REJECT. ...` instead of the requested first line `VERDICT: REJECT`. The supervisor read this as "no verdict" and accepted the step without review.
  - The same rewording happened in 3 of 6 reviews.
  - Fix: parse the bare word, retry the review once, and never accept unreviewed work (`needs_review`).

**Rules to add for Hermes or Dots**
- **Verdicts:** never rely on an exact output line from a bridged agent. Parse leniently, and treat "unknown" as "stop", never as "pass".
- **Tests:** locked tests prove the minimum only. Keep a reviewer from a different model on every step, and add a regression test for every bug the reviewer finds.

### 2026-11-25: run 3 (S2.1 re-opened by a human)

**What happened**
- **The resume worked.** A human set S2.1 back to `pending` on `agent/work`. Run [45643456596](https://github.com/segalz/cloud-agents-lab/actions/runs/45643456596) picked up S2.1 only, rewrote `src/update.mjs` (17 s), and got `APPROVE`.
- **All tests passed again.** The independent check re-ran all 25 tests, including the S2.2 to S3.2 tests that use `markDone`.
- **The title bug is gone:** now only the checkbox is checked.
- **But one gap remains, missed by both the tests and the reviewer.** `markDone` matches exactly one space around the id, while `parsePlan` accepts any whitespace. So a line like `- [ ]  S1.1  Title` is listed by `parsePlan` but reported as `unknown step` by `markDone`.
- **The bug was fixed by luck.** The writer never saw the reviewer's run-2 finding: feedback does not carry over between runs.
- **S2.2 and S3.1 are still unreviewed.** They show `n/a (no verdict)` from run 2, before the fix. Their reviewer notes read as approvals, but no verdict was parsed.

**Rules to add**
- **Carry feedback when re-opening a step.** When a step is re-opened, the supervisor must pass the last review findings, or the human's note, to the writer.
  - Next change: read the last `runs.jsonl` entry for that step and include it as feedback.
  - Also allow a `Note:` column in `progress.md`.
- **Share the parsing code.** When several steps parse the same format, require them to reuse one helper (here `STEP_RE` in `src/parse.mjs`), and test the shared format in every step that parses it.
- **Merging is a human's decision.** Before merging, a human must look at every row whose reviewer is not `approve`.

### 2026-11-25: runs 4 and 5 (feedback carried over; all 6 steps approved by the reviewer)

**Run 4 ([45647298363](https://github.com/segalz/cloud-agents-lab/actions/runs/45647298363))**
- **The owner's note reached the writer.** It arrived through `planning/notes/S2.1.md` (555 chars carried). The writer exported a shared `stepLine` regex from `src/parse.mjs` and reused it in `markDone`, and the reviewer approved.
- **The fix is partial, and the reviewer missed it.** It allows several spaces after the id, but still only one before it.
  - Rule: an owner note is a wish, not a check. Every behaviour that matters needs a locked test. Here the missing test is "extra spaces before the id".
- **New supervisor bug:**
  - **What happened:** S2.2 already had correct code, so the writer changed nothing. The supervisor counted "no changes" as a failure, and the step was marked `failed` after 2 attempts.
  - **Fix:** "no changes and the tests pass" now sends the existing files to review instead.

**Run 5 ([45648802232](https://github.com/segalz/cloud-agents-lab/actions/runs/45648802232))**
- **S2.2 rewritten and approved.** S2.2 got history feedback (230 chars), was rewritten (28 s), and Cline approved it.
- **S3.1 approved without changes.** The writer kept S3.1 as it was (the new path), and Cline approved the existing code.
- **Final state: 6/6 steps `approve`.**

**Problems on GitHub's side**
- GitHub itself had transient errors:
  - one `500` on a push;
  - one GraphQL error when updating the PR. That turned run 5 red even though the supervisor succeeded.
- Fix: the push already retries 3 times. The PR step now retries, and only warns.

**Rules to add**
- **Read the supervisor's exit code.** Hermes should read the result of the supervisor step itself (`run_end` in `log.md`), not only the colour of the Actions run.

## C. Draft rules for the future Hermes / Dots skill

Status: draft until part B confirms them.

**When to offer cloud work**
- The task is code in a **public** repository.
- It can be split into small steps, each with an automated check.
- The home PCs are off, or the owner says "run it in the cloud".

**When not to offer it**
- The work is private or sensitive.
- It needs the home LAN (`freellmapi`, local files).
- It is interactive design work.
- No check exists.

**How to run it**
1. Write or confirm `planning/plan.md` and the locked tests on `main`.
2. Trigger `agent-run` with `max_steps`.
3. Watch `planning/progress.md` on `agent/work`.
4. Report the PR link to the owner.

**After every run**
- Read the `run_end` entry.
- If the result is `step_failed`, read the last attempt's feedback. Then ask the owner, or fix the plan or test (on `main`, with the owner's OK), set the step back to `pending`, and re-run.
- Never merge. The owner merges.
