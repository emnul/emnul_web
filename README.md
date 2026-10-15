# emnul.dev

A developer journal and live Shader portfolio, built with Astro and deployed to Cloudflare Workers.

## Toolchain

Bun installs, Node runs (ADR 0005). Bun is the package manager and script runner; Astro, Vite and Vitest run under Node through their CLI shebangs, so scripts use `bun run`, never `bun --bun`. Both versions are pinned exactly: Bun in `package.json` `packageManager`, Node in `.node-version`. `bun.lock` is committed. Dependencies whose install scripts must run are listed in `trustedDependencies`.

`bun run dev` keeps the Cloudflare adapter's default `@cloudflare/vite-plugin` setup, so server code and prerendering run in workerd locally (ADR 0006). `nodejs_compat` is off in `wrangler.jsonc`.

Every commit runs a Husky pre-commit hook: lint-staged formats staged files with Prettier and lints them with ESLint, then `bun run check` type checks the project. A formatting fix is folded into the commit; an ESLint or type error blocks it. `bun install` installs the hook through the `prepare` script, which does nothing when `HUSKY=0` is set (as in Workers Builds) or there's no `.git`.

Every push runs a Husky pre-push hook: `bun run test` (unit), then `bun run test:browser` (Vitest browser mode on WebKit and Chromium, headless). A failing test in either blocks the push. Browser tests run only here, never in Workers Builds, which runs unit tests before `build` (ADR 0005).

Browser tests need the two Playwright browsers. Install them once after cloning, and again after a Playwright upgrade (the hook fails with `Executable doesn't exist` when they're missing):

```sh
bunx playwright install --only-shell webkit chromium
```

Unit tests match `*.test.ts`; browser tests match `*.browser.test.ts` and are left out of the unit run, so `bun run test` never needs the browsers.

Local secrets go in `.dev.vars`, which git ignores; `.env.example` lists their names.

See [ADR 0004](docs/adr/0004-public-repo-licensing.md) (repo and licences), [ADR 0005](docs/adr/0005-bun-package-manager-node-tooling.md) (Bun and Node) and [ADR 0006](docs/adr/0006-workerd-parity-and-preview-gate.md) (workerd parity and the Preview gate).

## Scripts

| Script                 | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `bun install`          | Install dependencies                            |
| `bun run dev`          | Dev server, with server code running in workerd |
| `bun run build`        | Build Workers deployment output into `dist/`    |
| `bun run preview`      | Serve the build locally                         |
| `bun run check`        | Type check with `astro check`                   |
| `bun run lint`         | ESLint                                          |
| `bun run format`       | Format the tree with Prettier                   |
| `bun run format:check` | Check formatting without writing                |
| `bun run test`         | Vitest unit tests                               |
| `bun run test:browser` | Vitest browser tests on WebKit and Chromium     |

## Licences

Site code is MIT ([LICENSE](LICENSE)). Shaders in `src/content/shaders/` are CC BY-NC-SA 4.0 and Posts in `src/content/posts/` are CC BY-NC-ND 4.0; each folder holds its own licence file.

## Working with Claude Code

Launch Claude with `omni claude`, not `claude`. Omnigent's policies let Claude commit locally but deny direct `git push` and other commands that would publish to or rewrite the remote (ADR 0006). Until the GitHub remote exists, a push wrapped in `bash -c` or `eval` may only prompt for approval, so decline it. The author pushes and opens PRs.

The policies can't live in this repo: `omni claude` starts its local server with `--config ~/.omnigent/config.yaml`, and only that file's `policies:` block is read. Add this to `~/.omnigent/config.yaml` (it applies to every project you run with `omni claude`):

```yaml
policies:
  blast_radius:
    type: function
    handler: omnigent.policies.builtins.orchestration.blast_radius
    factory_params:
      risky_action: DENY
  github:
    type: function
    handler: omnigent.policies.builtins.github.github_policy
```

The running server doesn't reload policies, so run `omni server stop` after editing, then `omni claude`.
