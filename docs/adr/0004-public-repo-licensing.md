# Public repo with explicit licences

The repo is public. That gives free GitHub branch protection (see ADR 0006), and keeping the source private to stop AI training isn't a battle worth fighting: licences don't reliably prevent training, and crawlers don't reliably honour blocks. The author's position is stated rather than enforced. The site keeps Cloudflare's AI crawler blocking and a `robots.txt` that disallows AI training bots while allowing ordinary search engines, because both are free. They are not relied on as protection.

Licences: site code MIT; Shaders CC BY-NC-SA 4.0 by default (Shadertoy norms), overridable per Shader with an `attribution` field for adapted work; Posts CC BY-NC-ND 4.0, with code snippets in Posts MIT. A root `LICENSE` covers the code, and each content folder carries its own licence file so the terms sit next to the content.

## Considered Options

- **Private repo with GitHub Pro for branch protection**: kept Post sources off GitHub, but at a monthly cost to defend something crawler blocking can't guarantee anyway.
- **Public code with a separate private content repo**: rejected as too much wiring for a personal site.

## Consequences

- Drafts are publicly readable in the repo as soon as they're pushed. Anything that must stay private stays on unpushed branches or outside the repo.
- Secrets never enter git: `.dev.vars` and `.env*` are ignored from the first commit, the GitHub token lives only in Workers secrets, and GitHub secret scanning with push protection is on.
- The code is visible as a portfolio artifact, so the renderer doesn't need extracting into its own repo for that reason.
