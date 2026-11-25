# cloud-agents-lab

This is an experiment. Free coding agents build a small real tool, `plan-tracker`, on **GitHub Actions** while a supervisor checks every step.

| Role | Who | How |
|---|---|---|
| Writer | OpenCode (free NVIDIA models) | [`openCodeHelperMcp`](https://github.com/segalz/openCodeHelperMcp) bridge, `apply_opencode_edits` |
| Reviewer | Cline (provider `nvidia`) | [`ClineMcp`](https://github.com/segalz/ClineMcp) bridge, `ask_cline_workspace` |
| Supervisor | `runner/supervisor.mjs` (later Hermes or Dots) | rules in `planning/instructions/supervisor.md` |

## Where things are
- `planning/plan.md`: stages and micro-steps. Each step has its allowed files and its check.
- `planning/progress.md`: live status table. The next run resumes from here.
- `planning/log.md` and `planning/runs.jsonl`: every attempt, with model, timing, checks and review.
- `planning/lessons.md`: what we learned, and the draft rules for Hermes or Dots.
- `planning/instructions/`: exact instructions for the writer, the reviewer and the supervisor.
- `planning/drive-sharing.md`: when and how Google Drive could connect other agents.
- `tests/locked/`: tests the agents may not change. Their hashes are in `tests/LOCKED.sha256`.

## Run it
```
gh workflow run agent-run -R segalz/cloud-agents-lab -f max_steps=2
```
- The work goes to the `agent/work` branch and a PR to `main`.
- A human merges the PR. Agents never merge.
- The `NVIDIA_API_KEY` repository secret is required.
