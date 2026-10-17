# Match workerd locally, and reach Production only through a Preview

Production runs on Cloudflare's workerd: V8 isolates with web-standard APIs and Cloudflare bindings, not Node or Bun. Bugs that only show up after deploying come from missing APIs, per-request isolates and platform limits, not from the engine. Almost the whole site is prerendered static output, so only the few on-demand routes are exposed. We guard them in three layers:

1. `astro dev` keeps the Cloudflare adapter's default `@cloudflare/vite-plugin` setup, so server code and prerendering run in workerd locally.
2. On-demand routes use only web-standard APIs, the Cache API and `env` from `cloudflare:workers`. `nodejs_compat` stays off until a dependency needs it, and the reason is recorded when it's turned on.
3. Every change goes feature branch → `staging` → `main`. Workers Builds deploys Production from `main` with its Preview builds turned off, so pushes to feature branches spend no build minutes. A GitHub Actions workflow deploys the Preview on each push to `staging` with `wrangler preview --name staging`, recording a deployment to the `staging` GitHub environment, which only the `staging` branch may deploy to. GitHub rulesets on both branches require a PR (0 approvals; merging is the human review) and block force pushes and deletion, with no bypass. The `main` ruleset also requires a successful `staging` deployment. Every merge into `staging` makes a new commit, so a feature branch's commits are never deployed and a PR straight from one into `main` can't merge. `staging` merges into `main` with a merge commit so the two branches don't diverge. There is no agent-side push guard.

## Considered Options

- **Required approvals with a separate bot identity for Claude**: enforces review of agent changes server-side, but means maintaining a GitHub App or machine user. Merging the PR is already the human review.
- **A Preview for every PR**: Workers Builds builds every push to every branch, so frequent WIP pushes burned through the monthly build quota. Routing everything through `staging` keeps one Preview gate on `main` while builds happen only when work lands in `staging`.
- **Workers Builds Preview builds for `staging`**: Workers Builds' only branch control is the production branch plus an on/off switch for every other branch, so it can't build `staging` alone. Exiting early on other branches still spends a clone and install per push.
- **A required check on the PR's head branch name**: rulesets can't restrict a PR's source branch, so this needs its own workflow. The required `staging` deployment covers it and gates on the code that was actually previewed.
- **Agent-side push guard**: a Claude Code PreToolUse hook, later Omnigent policies under `omni claude`, denied direct and force pushes from the agent. Dropped as too obstructive; the `main` ruleset already blocks force pushes and unreviewed merges server-side.

## Consequences

Astro 6.3.5 with adapter v13.5.2 had a reported bug where `wrangler.jsonc` vars didn't reach `astro:env`; check it's fixed before relying on `astro:env`, or import `env` from `cloudflare:workers` instead.
