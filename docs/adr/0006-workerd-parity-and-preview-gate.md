# Match workerd locally, and reach Production only through a Preview

Production runs on Cloudflare's workerd: V8 isolates with web-standard APIs and Cloudflare bindings, not Node or Bun. Bugs that only show up after deploying come from missing APIs, per-request isolates and platform limits, not from the engine. Almost the whole site is prerendered static output, so only the few on-demand routes are exposed. We guard them in three layers:

1. `astro dev` keeps the Cloudflare adapter's default `@cloudflare/vite-plugin` setup, so server code and prerendering run in workerd locally.
2. On-demand routes use only web-standard APIs, the Cache API and `env` from `cloudflare:workers`. `nodejs_compat` stays off until a dependency needs it, and the reason is recorded when it's turned on.
3. Every change reaches `main` through a PR whose Workers Builds Preview has deployed. A GitHub ruleset on `main` requires a PR (0 approvals; merging is the human review), requires the Workers Build check, and blocks force pushes and deletion, with no bypass. On the agent side, Claude Code runs under Omnigent (`omni claude`), whose built-in `blast_radius` and `github_policy` policies (server-wide, in the user-level `~/.omnigent/config.yaml`; see the README) deny direct pushes and force pushes from the agent; a push wrapped in `bash -c` or `eval` may only prompt for approval until the GitHub remote exists. Claude commits locally, and the author pushes and opens PRs. Local destructive git commands (`reset --hard`, `clean -f`, `branch -D`, `checkout .`, `restore .`) stay allowed because they only touch the local copy.

## Considered Options

- **Required approvals with a separate bot identity for Claude**: enforces review of agent changes server-side, but means maintaining a GitHub App or machine user. The agent-side Omnigent policy is enough for now.

## Consequences

Astro 6.3.5 with adapter v13.5.2 had a reported bug where `wrangler.jsonc` vars didn't reach `astro:env`; check it's fixed before relying on `astro:env`, or import `env` from `cloudflare:workers` instead.

The agent-side policy replaced a project-scoped Claude Code PreToolUse hook, and it only applies when Claude is launched with `omni claude`; a plain `claude` launch has no push guard, leaving the `main` ruleset as the only server-side control. Omnigent has no per-project policies, so the policy is server-wide user config rather than committed with the repo: it applies to every project run with `omni claude` on that machine, each developer sets it up themselves, and the running server only picks up changes after `omni server stop`. `blast_radius` also denies a commit whose message contains a hard reset to a remote ref (e.g. `git reset --hard origin/main`). `blast_radius` doesn't look inside `bash -c`, and with no remote `github_policy` asks rather than denies, so a wrapped push isn't denied yet; RED-26 re-tests this once the GitHub remote exists.
