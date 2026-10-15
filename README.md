# emnul.dev

A developer journal and live Shader portfolio, built with Astro and deployed to Cloudflare Workers.

## Toolchain

Bun installs, Node runs (ADR 0005). Bun is the package manager and script runner; Astro, Vite and Vitest run under Node through their CLI shebangs, so scripts use `bun run`, never `bun --bun`. Both versions are pinned exactly: Bun in `package.json` `packageManager`, Node in `.node-version`. `bun.lock` is committed. Dependencies whose install scripts must run are listed in `trustedDependencies`.

`bun run dev` keeps the Cloudflare adapter's default `@cloudflare/vite-plugin` setup, so server code and prerendering run in workerd locally (ADR 0006). `nodejs_compat` is off in `wrangler.jsonc`.

Local secrets go in `.dev.vars`, which git ignores; `.env.example` lists their names.

See [ADR 0004](docs/adr/0004-public-repo-licensing.md) (repo and licences), [ADR 0005](docs/adr/0005-bun-package-manager-node-tooling.md) (Bun and Node) and [ADR 0006](docs/adr/0006-workerd-parity-and-preview-gate.md) (workerd parity and the Preview gate).

## Scripts

| Script | What it does |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Dev server, with server code running in workerd |
| `bun run build` | Build Workers deployment output into `dist/` |
| `bun run preview` | Serve the build locally |
| `bun run check` | Type check with `astro check` |
| `bun run lint` | ESLint |
| `bun run test` | Vitest unit tests |

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
