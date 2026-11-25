# Progress

The supervisor (`runner/supervisor.mjs`) updates this file after every attempt. It also commits the file to the `agent/work` branch and pushes it.

The next run always starts from the first row whose status is `pending` or `in_progress`.

- **To re-run a step:** set its status back to `pending`.
- **To skip a step:** set its status to `skipped`.

**Status values:**
- `pending`
- `in_progress`, which means it was interrupted: the next run resumes it.
- `done`
- `failed`, which means the attempts ran out: a human or the supervisor decides what happens next.
- `skipped`

Last run: 2026-11-25T16:30:08Z · run [45652760008](https://github.com/segalz/cloud-agents-lab/actions/runs/45652760008) · step_failed S2.1 · 5/6 steps done

| Step | Title | Status | Attempts | Writer | Reviewer | Commit | Updated (UTC) |
|---|---|---|---|---|---|---|---|
| S1.1 | Parse checklist steps | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | da1ef7e | 2026-11-25T15:05:32Z |
| S1.2 | Find the next step | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | 9cf7614 | 2026-11-25T15:06:08Z |
| S2.1 | Mark a step done | failed | 5 | - | - | - | 2026-11-25T16:30:07Z |
| S2.2 | Summary numbers | done | 4 | nvidia/poolside/laguna-xs-2.1 | approve | d571598 | 2026-11-25T15:50:12Z |
| S3.1 | `next` command | done | 2 | nvidia/poolside/laguna-xs-2.1 | approve | decb731 | 2026-11-25T15:55:33Z |
| S3.2 | `status` and `done` commands | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | 54895c6 | 2026-11-25T15:15:21Z |
