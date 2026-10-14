# Shadertoy-compatible Shaders on a hand-rolled WebGL2 renderer

Shaders are written against the Shadertoy contract (`mainImage(out vec4, in vec2)` with Shadertoy-named Inputs) so they can be copied to and from Shadertoy unchanged. They run on a small, dependency-free WebGL2 renderer written in plain TypeScript (with a thin React wrapper), rather than three.js or twgl, because the surface needed is one fullscreen triangle and a uniform loop, and the renderer is shared by Embeds, the Gallery, and the planned Editor.

## Consequences

- v1 is single-pass only: no `iChannel0-3` or buffers. A Shader that references them fails with a clear error.
- The renderer must report compile errors as structured `{line, message}` data, for the Still fallback now and the Editor later.
- Renders at full device pixel ratio by default; `maxPixelRatio` is overridable per Shader.
