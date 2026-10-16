# Shaders may declare Parameters beyond the Shadertoy Inputs

Some Shaders need values a visitor can adjust, which the Shadertoy contract (ADR 0003) has no way to express. A Shader lists its Parameters in frontmatter (`name`, `label`, `default`, `min`, `max`, `step`); the core injects a `uniform float <name>;` for each one, the same way it injects the Inputs, and the site shows a slider per Parameter. The GLSL file never declares them, so the Shadertoy copy in the source panel prepends `const float <name> = <default>;` and the Shader still runs there unchanged. The frontmatter schema rejects a Parameter name that collides with an Input.

## Considered Options

- **Annotated `uniform` declarations in the GLSL**: keeps everything in one file, but means parsing GLSL, and the file no longer pastes into Shadertoy.
- **Encode values in `iMouse`**: no contract change, but gives only two axes and is awkward to present.
