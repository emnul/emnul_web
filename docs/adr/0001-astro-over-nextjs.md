# Astro over Next.js

The site is mostly static content (Posts, Shaders) plus self-contained interactive widgets (Shader canvases, the planned Editor, interactive demos, a GitHub activity widget), with nothing that must persist across navigation. We chose Astro with React islands over Next.js because it ships zero JS by default, has typed MDX content collections built in, and its `client:visible` hydration matches the Shader on-screen-only rendering rule — the least complexity for this shape. React is still used for every interactive component.

## Considered Options

- **Next.js (App Router)**: stronger if the site grows into a full app with shared cross-page state; rejected because anything app-like will be a separately deployed Project, and Next.js adds MDX wiring and a client runtime on every page. Reconsidered for Turbopack and Bun dev speed (ADR 0005): the decision stands, since it would also mean the OpenNext layer on Workers and manual `.glsl` loader rules.
- **Eleventy / hand-rolled Vite**: rejected for the extra wiring needed for islands and bundling.

## Consequences

Revisit if a persistent cross-page UI (background shader, persistent player) or app-like features inside the site become requirements.
