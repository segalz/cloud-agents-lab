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
