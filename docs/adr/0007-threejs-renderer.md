# Render Shaders with three.js instead of a hand-rolled WebGL2 renderer

This replaces ADR 0003's choice of a hand-rolled renderer; the rest of 0003 (the Shadertoy contract, single-pass v1, structured compile errors, device pixel ratio) still holds. The renderer stopped being something worth building by hand once a Shader needed off-screen render targets and pixel readback for measurement, which three.js provides as `WebGLRenderTarget` and `readRenderTargetPixels`. three.js is also common in web-based optics and design tooling, which this site aims to show fluency in. Shaders use `RawShaderMaterial` with `glslVersion: THREE.GLSL3` on a fullscreen plane, so three.js adds nothing in front of our source and the core's line-offset error mapping still works.

## Considered Options

- **Keep it hand-rolled**: the most control, but slower, and the renderer was no longer the interesting part.
- **twgl.js**: a few KB of WebGL helpers; saves little time and offers none of the reasons above.

## Consequences

- About 150 KB gzipped of three.js on pages that render a Shader. Keep it out of pages that don't.
- `ShaderMaterial` and `RawShaderMaterial` only work with `WebGLRenderer`. Moving to `WebGPURenderer` would mean rewriting Shaders in TSL, so stay on `WebGLRenderer` until that changes.
