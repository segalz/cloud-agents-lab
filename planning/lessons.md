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
