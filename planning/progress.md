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

Last run: 2026-11-25T15:06:09Z · run [45640745890](https://github.com/segalz/cloud-agents-lab/actions/runs/45640745890) · max_steps_reached · 2/6 steps done

| Step | Title | Status | Attempts | Writer | Reviewer | Commit | Updated (UTC) |
|---|---|---|---|---|---|---|---|
| S1.1 | Parse checklist steps | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | da1ef7e | 2026-11-25T15:05:32Z |
| S1.2 | Find the next step | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | 9cf7614 | 2026-11-25T15:06:08Z |
| S2.1 | Mark a step done | done | 1 | nvidia/poolside/laguna-xs-2.1 | n/a (no verdict) | f5d498e | 2026-11-25T15:12:18Z |
| S2.2 | Summary numbers | done | 1 | nvidia/poolside/laguna-xs-2.1 | n/a (no verdict) | 0c4c03e | 2026-11-25T15:12:42Z |
| S3.1 | `next` command | done | 1 | nvidia/poolside/laguna-xs-2.1 | n/a (no verdict) | 595bb70 | 2026-11-25T15:14:03Z |
| S3.2 | `status` and `done` commands | pending | 0 | - | - | - | - |
