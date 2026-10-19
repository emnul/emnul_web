# Bun installs, Node runs the tooling; Vitest and Playwright for tests

Bun is the package manager and script runner (`bun install`, `bun run …`, committed `bun.lock`). Node runs Astro, Vite, Vitest, Playwright and our own scripts. Astro is built on Vite, so Bun can't replace the bundler here. Production runs on workerd (ADR 0006), so neither runtime reaches visitors. What's left is install speed, which Bun wins, and toolchain stability, which Node wins for Astro, Vite and Playwright. Both versions are pinned exactly (`packageManager`, `.node-version`, and `BUN_VERSION`/`NODE_VERSION` in Workers Builds). Choosing Bun and Node together still leaves one shared `node_modules`. Dependencies whose install scripts must run are listed in `trustedDependencies`.

Testing: Vitest unit tests for pure renderer logic run in Workers Builds before `build`. Vitest browser mode with the Playwright provider, on WebKit and Chromium, covers real WebGL2 compilation: a Shader that compiles, and a compile error reported at the author's line. Uniform and syntax checks against the frontmatter run in the build (ADR 0009). Browser tests run locally only, through a Husky pre-push hook (`bun run test && bun run test:browser`). A pre-commit hook runs lint-staged with Prettier and ESLint, then `astro check`. `HUSKY=0` is set in Workers Builds.

Stills are rendered locally and committed, so no build environment needs a browser: `node scripts/generateStills.ts` (run with `bun run stills`) has Vite serve `scripts/stills-harness.html`, which bundles the site's own renderer, then headless Chromium renders one 1600×900 frame of each Shader with `u_time` at its `still.time` (frontmatter, default 0), each Parameter at its `still.parameters` value or else its default, and writes it to `<slug>/still.png`. Run it after changing a Shader's source, `still.time`, `still.parameters` or a Parameter's default, and commit the result; nothing checks that a committed Still is current. The live Shader starts at `still.time` too, but with each Parameter at its default, so its first frame matches the Still shown while it loads unless `still.parameters` sets one. A Shader that fails to compile also fails it, and `astro build` reports any Shader without a Still. Astro's `<Image>` produces the optimized variants at build time. Scripts are written in erasable-only TypeScript (`erasableSyntaxOnly`) so Node can run them directly.

## Considered Options

- **Bun as the runtime under Astro/Vite (`bun --bun`)**: faster startup, but runs the toolchain on a runtime it isn't mainly tested on; for a project this small the speed gain wouldn't be noticeable.
- **`bun test`**: doesn't use Vite's import handling, so `.glsl?raw` and content-collection imports would need Bun plugins.
- **Bun.WebView for Stills and WebGL tests**: experimental, no Vitest browser provider, so it would need a hand-rolled harness built by a different bundler than the site; on Linux it needs a Chrome install. Rejected in favour of Playwright.
- **Bun.Image**: duplicates Astro's build-time image pipeline.
- **A pre-push hook that re-renders Stills and blocks on any change**: needs byte-identical renders, so Chromium would have to render on SwiftShader (CPU) rather than the GPU, and a Chromium upgrade would still change every Still at once.
- **Rendering Stills during the build**: a Still could never be stale, but Workers Builds and the Preview workflow would need Chromium and its system libraries, and a browser failure would block a deploy.
- **Running `scripts/generateStills.ts` under Bun**: Playwright supports only Node, and browser launching is where Bun's Node compatibility has had gaps.
- **Next.js with Turbopack**: reconsidered against ADR 0001; a Rust bundler makes the runtime matter even less, and the other trade-offs are unchanged.

## Consequences

Revisit if Astro officially supports the Bun runtime, or if install or dev speed becomes a real pain point. Move the browser tests into CI (most likely GitHub Actions) once enough depends on them that a forgotten local run is a real risk.
