# Bun installs, Node runs the tooling; Vitest and Playwright for tests

Bun is the package manager and script runner (`bun install`, `bun run …`, committed `bun.lock`). Node runs Astro, Vite, Vitest, Playwright and our own scripts. Astro is built on Vite, so Bun can't replace the bundler here. Production runs on workerd (ADR 0006), so neither runtime reaches visitors. What's left is install speed, which Bun wins, and toolchain stability, which Node wins for Astro, Vite and Playwright. Both versions are pinned exactly (`packageManager`, `.node-version`, and `BUN_VERSION`/`NODE_VERSION` in Workers Builds). Choosing Bun and Node together still leaves one shared `node_modules`. Dependencies whose install scripts must run are listed in `trustedDependencies`.

Testing: Vitest unit tests for pure renderer logic run in Workers Builds before `build`. Vitest browser mode with the Playwright provider, on WebKit and Chromium, covers real WebGL2 compilation: a Shader that compiles, and a compile error reported at the author's line. Uniform and syntax checks against the frontmatter run in the build (ADR 0009). Browser tests run locally only, through a Husky pre-push hook (`bun run test && bun run test:browser`). A pre-commit hook runs lint-staged with Prettier and ESLint, then `astro check`. `HUSKY=0` is set in Workers Builds.

Stills are generated locally and committed: `node scripts/stills.ts` (run with `bun run stills`) opens a dev-only `/_harness/[slug]` route in Playwright, freezes `u_time` at the Shader's `still.time` (frontmatter, default 1.0), sets any `still.parameters` (other Parameters keep their defaults), and screenshots the canvas at 1600×900 with `deviceScaleFactor: 1`. Astro's `<Image>` produces the optimized variants at build time. Scripts are written in erasable-only TypeScript (`erasableSyntaxOnly`) so Node can run them directly.

## Considered Options

- **Bun as the runtime under Astro/Vite (`bun --bun`)**: faster startup, but runs the toolchain on a runtime it isn't mainly tested on; for a project this small the speed gain wouldn't be noticeable.
- **`bun test`**: doesn't use Vite's import handling, so `.glsl?raw` and content-collection imports would need Bun plugins.
- **Bun.WebView for Stills and WebGL tests**: experimental, no Vitest browser provider, so it would need a hand-rolled harness built by a different bundler than the site; on Linux it needs a Chrome install. Rejected in favour of Playwright.
- **Bun.Image**: duplicates Astro's build-time image pipeline.
- **Running `scripts/stills.ts` under Bun**: Playwright supports only Node, and browser launching is where Bun's Node compatibility has had gaps.
- **Next.js with Turbopack**: reconsidered against ADR 0001; a Rust bundler makes the runtime matter even less, and the other trade-offs are unchanged.

## Consequences

Revisit if Astro officially supports the Bun runtime, or if install or dev speed becomes a real pain point. Move the browser tests into CI (most likely GitHub Actions) once enough depends on them that a forgotten local run is a real risk.
