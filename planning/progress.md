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

Last run: none yet

| Step | Title | Status | Attempts | Writer | Reviewer | Commit | Updated (UTC) |
|---|---|---|---|---|---|---|---|
| S1.1 | Parse checklist steps | done | 1 | nvidia/poolside/laguna-xs-2.1 | approve | da1ef7e | 2026-11-25T15:05:32Z |
| S1.2 | Find the next step | in_progress | 0 | - | - | - | 2026-11-25T15:05:33Z |
| S2.1 | Mark a step done | pending | 0 | - | - | - | - |
| S2.2 | Summary numbers | pending | 0 | - | - | - | - |
| S3.1 | `next` command | pending | 0 | - | - | - | - |
| S3.2 | `status` and `done` commands | pending | 0 | - | - | - | - |
