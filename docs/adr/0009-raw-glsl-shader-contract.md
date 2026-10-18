# Shaders are raw GLSL ES 3.00 fragment shaders

A Shader's `shader.glsl` is a complete GLSL ES 3.00 fragment shader, without `#version` (the renderer supplies it, ADR 0010). The author writes their own precision lines, `uniform` declarations, `out vec4` and `main()`. Nothing is injected, so the file is the whole program. We first wrote Shaders against the Shadertoy contract (`mainImage` plus Shadertoy-named uniforms) so they could be copied to and from Shadertoy unchanged. We dropped that because the site's own features, such as Parameters (ADR 0011), kept bending around a contract owned by another site.

- **Inputs** use the Book of Shaders names: `u_resolution` (`vec2`, pixels of the current render target) and `u_time` (`float`, seconds: the Shader's `still.time` plus how long it has been running, so its first frame matches its Still). A Shader declares the ones it uses. More are added only when a Shader needs one.
- **Single-pass only**: no buffers and no samplers.
- **Every Shader is animated**: it runs a frame loop for as long as its page is open, whether or not it is on screen. Under reduced motion it shows its Still with a play control, and nothing moves until the visitor presses play. Reduced motion is not implemented yet.
- **The build checks each source against its frontmatter.** For every Shader, Drafts included, the Shader core parses the GLSL with `@shaderfrog/glsl-parser`. `astro build` fails on a syntax error, a `#version` line, a uniform that is neither an Input nor a Parameter, a sampler, a wrong type, or a Parameter with no uniform. Errors are reported as `{line, message}` at the author's line.

## Considered Options

- **Keep the Shadertoy contract, with a Shadertoy export**: kept compatibility, but a raw file would need an export transform, and Parameters still needed a workaround.
- **Inject Input and Parameter declarations from frontmatter**: makes a mismatch impossible, but the file is no longer a complete program, and every compile error needs a line offset for the injected header.
- **Find uniforms with a regex**: too many edge cases (comments, declarations split over lines, comma lists), and it can't report syntax errors.
- **Declare Parameters in GLSL comment annotations, as ISF does**: one file, but needs a parser of our own and puts presentation into the GLSL.

## Consequences

- A Shader scrolled off screen keeps using the GPU. An earlier version of this decision paused Shaders off screen; we dropped that.
- Shaders no longer paste into Shadertoy or the Book of Shaders editor, and code from either needs porting by hand.
- The parser runs without the preprocessor, so line numbers match the author's file. A uniform inside a false `#if` still counts as declared.
- The parser doesn't type-check. An undefined name inside `main()` still fails only when a browser compiles it: in the browser tests, the Stills script, or for a visitor.
