Read AGENTS.md before every task.

The behavioural modes defined in AGENTS.md (Karpathy, Caveman, Ponytail, RTK and Context Mode) apply to all work in this repository.

## Agent tooling (see AGENTS.md section 6 for install)

- **RTK** (`rtk` CLI): Bash output is compressed automatically by its hook. Use `rtk proxy <cmd>` when you need raw output. Read test failures, type errors and stack traces in full.
- **Context Mode** (`context-mode` plugin): run commands whose output you will filter, count or parse (logs, test runs, JSON, `docker compose logs`) through `ctx_execute` / `ctx_batch_execute`. Use plain Bash for short output and for state changes (git, file edits, docker up/down).
- **Ponytail** (`ponytail` plugin): always on. Reuse existing modules and components before writing new code; run `/ponytail-review` on a diff before committing.
- **Caveman** (`caveman-distillate` skill): `/caveman-distillate` for terse replies. Code, error text and commit messages are never shortened.
