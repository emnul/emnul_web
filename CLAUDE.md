# CLAUDE.md

## Agent skills

### Issue tracker

Issues live in GitHub Issues (with GitHub Projects), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Branch naming

Branch names follow the [Conventional Branch](https://conventionalbranch.org/)
specification: `<type>/<description>`, lowercase, hyphen-separated.

Types: `feature/` (or `feat/`), `bugfix/` (or `fix/`), `hotfix/`, `release/`, `chore/`.
`main`, `master` and `develop` take no prefix.

Examples: `feature/add-login-page`, `bugfix/fix-header-overflow`, `release/v1.2.0`.

When you create a branch yourself rather than at a person's direction, prefix it with
your own agent name instead — `claude/`, `codex/`, `copilot/`, `cursor/`, or the
vendor-neutral `ai/` — so the branch records who wrote it.

### Domain docs

Single-context layout: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
