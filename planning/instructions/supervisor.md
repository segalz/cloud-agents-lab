# Supervisor instructions

These rules are what `runner/supervisor.mjs` does today. They are also the draft for a future Hermes skill, or for Dots, when one of them takes over the supervisor role.

## Loop (one run)
1. **Start from the branch.** Work on the `agent/work` branch, never on `main`. Merge `main` into it first, so plan and runner updates arrive.
2. **Find the step.** Read `planning/progress.md` and take the first row whose status is `pending` or `in_progress`. If there is none, stop: the work is done.
3. **Load the step.** Take the step's section from `planning/plan.md`, including its "Files allowed" and "Verify" lines.
4. **Mark it started.** Set the row to `in_progress`, then commit and push. A crash after this point resumes from this row.
5. **Writer:** call `apply_opencode_edits` with these arguments:
   - `prompt`: `instructions/writer.md`, the step spec, and the feedback from the previous attempt;
   - `verify`: the step's test;
   - `maxFixRuns`: 2;
   - exactly one model.
   - If the result is a quota or rate-limit failure, move to the next model. This does not count as an attempt.
6. **Gates.** The supervisor checks these itself and never trusts the writer's claims. If any gate fails, the tree is cleaned and the attempt fails, with feedback:
   - **Locked tests:** the hashes of `tests/locked/*` must match `tests/LOCKED.sha256` from `main`.
   - **Scope:** only "Files allowed" may change.
   - **Something changed:** at least one file was modified.
   - **Independent check:** this step's test plus the tests of every earlier `done` step. If it fails, run it once more before rejecting ("flaky first").
7. **Commit the candidate.** Before committing, run the secret scan: block the commit if it contains a known key value or an `nvapi-` token.
8. **Reviewer:** call `ask_cline_workspace` on HEAD with `instructions/reviewer.md`, the step spec and the diff.
   - `VERDICT: REJECT`: undo the candidate commit and retry the writer with the reasons as feedback.
   - **Reading the verdict:** the Cline bridge returns Cline's own submission text, so the requested first line is often reworded, for example `Submission recorded (verified): REJECT. ...`. Read `VERDICT: X` if it is there. Otherwise use the first bare `APPROVE` or `REJECT`.
   - **No verdict:** run the review once more. If there is still no verdict, mark the step `needs_review`, keep the candidate commit, and stop the run. Never accept unreviewed work. Run 2 showed why: a real bug was accepted because a `REJECT` was missed.
9. **Record.** After every attempt, append to `planning/log.md` and `planning/runs.jsonl`, update `planning/progress.md`, then commit and push.
10. **Stop rule.**
    - After `MAX_ATTEMPTS` (default 2) failed attempts, mark the step `failed` and stop the run. Later steps are never attempted after a failure.
    - Stop when `MAX_STEPS` steps are done.
    - Stop when the time budget is nearly used up.
11. **Report.** Open or update a PR from `agent/work` to `main`. A human merges it; agents never merge.

## Safety
- Secrets reach the job only as files written at runtime (`~/.local/share/opencode/auth.json` and `~/.cline/data/settings/providers.json`). They never appear in the environment of the agents. Variables whose names contain TOKEN, KEY or SECRET are removed before the bridges start.
- The checkout does not keep the GitHub token (`persist-credentials: false`). Only the supervisor's push command gets the token.
- The repository is public, so never write private data into `planning/`.
- Only one run at a time (`concurrency: agent-run`). The two bridges share one checkout lock.
