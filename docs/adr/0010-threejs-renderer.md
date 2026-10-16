# Render Shaders with three.js

Shaders render through three.js `WebGLRenderer`, using a `RawShaderMaterial` with `glslVersion: THREE.GLSL3` on a fullscreen plane. A Shader needs off-screen render targets and pixel readback for measurement, and three.js provides them as `WebGLRenderTarget` and `readRenderTargetPixels`. three.js is also common in web-based optics and design tooling, which this site aims to show fluency in. The renderer is plain three.js behind a thin React wrapper.

three.js puts a `#version 300 es` line, two `#define SHADER_*` lines and any `material.defines` in front of the source. A Shader therefore leaves out `#version` (ADR 0009), and the renderer subtracts those prepended lines before reporting a compile error at the author's line. The renderer renders at full device pixel ratio by default, and `maxPixelRatio` caps it per Shader.

## Considered Options

- **A hand-rolled WebGL2 renderer**: the most control, and enough for one fullscreen triangle, but render targets and readback would have to be built by hand.
- **twgl.js**: a few KB of WebGL helpers; saves little time and offers none of the reasons above.
- **react-three-fiber**: declares three.js scene graphs as JSX. One fullscreen plane isn't a scene graph, and render targets would go through its `useThree()` escape hatch, so it would add a second way to drive the same renderer.

## Consequences

- About 150 KB gzipped of three.js on pages that render a Shader. Keep it out of pages that don't.
- `RawShaderMaterial` only works with `WebGLRenderer`. Moving to `WebGPURenderer` would mean rewriting Shaders in TSL, so stay on `WebGLRenderer` until that changes.
