# Match workerd locally, and reach Production only through a Preview

Production runs on Cloudflare's workerd: V8 isolates with web-standard APIs and Cloudflare bindings, not Node or Bun. Bugs that only show up after deploying come from missing APIs, per-request isolates and platform limits, not from the engine. Almost the whole site is prerendered static output, so only the few on-demand routes are exposed. We guard them in three layers:

1. `astro dev` keeps the Cloudflare adapter's default `@cloudflare/vite-plugin` setup, so server code and prerendering run in workerd locally.
2. On-demand routes use only web-standard APIs, the Cache API and `env` from `cloudflare:workers`. `nodejs_compat` stays off until a dependency needs it, and the reason is recorded when it's turned on.
3. Every change reaches `main` through a PR whose Workers Builds Preview has deployed. A GitHub ruleset on `main` requires a PR (0 approvals; merging is the human review), requires the Workers Build check, and blocks force pushes and deletion, with no bypass. There is no agent-side push guard.

## Considered Options

- **Required approvals with a separate bot identity for Claude**: enforces review of agent changes server-side, but means maintaining a GitHub App or machine user. Merging the PR is already the human review.
- **Agent-side push guard**: a Claude Code PreToolUse hook, later Omnigent policies under `omni claude`, denied direct and force pushes from the agent. Dropped as too obstructive; the `main` ruleset already blocks force pushes and unreviewed merges server-side.

## Consequences

Astro 6.3.5 with adapter v13.5.2 had a reported bug where `wrangler.jsonc` vars didn't reach `astro:env`; check it's fixed before relying on `astro:env`, or import `env` from `cloudflare:workers` instead.
