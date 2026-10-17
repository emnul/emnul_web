# Coding standards

Judgement calls for review. Tooling enforces lint, types and formatting; names follow `docs/agents/domain.md`.

## Tests

- **Tests own their inputs.** A unit test builds every input it checks. Real content under `src/content/` is checked by `astro build`, so adding a Shader or Post never edits a test.
- **Public interface only.** A test calls a module's exports and asserts on what they return, so it survives a rewrite of the implementation.

## Decisions that bind code

From `docs/adr/`:

- 0005: which tests run where.
- 0006: on-demand code uses only web-standard APIs, with `nodejs_compat` off.
- 0009–0011: the Shader contract (raw GLSL, Inputs, Parameters) and its renderer.
