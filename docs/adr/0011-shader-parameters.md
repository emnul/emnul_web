# Parameters are typed, declared in GLSL and described in frontmatter

A Parameter is declared twice under one name. `shader.glsl` declares it as a uniform, and the frontmatter `parameters` list describes it: its `name`, its `type` and that type's presentation fields. The build fails when the two disagree (ADR 0009). Each Parameter type has one GLSL type and one Control:

| Type     | GLSL    | Frontmatter                                  | Control       |
| -------- | ------- | -------------------------------------------- | ------------- |
| `number` | `float` | `label`, `default`, `min`, `max`, `step`     | slider        |
| `choice` | `int`   | `label`, `options`, `default` (option index) | radio buttons |

A new type, such as a switch or a colour, is a new member of the schema's union with its own GLSL type and Control. The Controls are our own small React component built on native inputs and styled like the site. On change it sets `material.uniforms[name].value` on the three.js material.

## Considered Options

- **Leva**: generates controls from a schema, but looks like a developer tool panel and has no radio buttons.
- **Encode values in a mouse Input**: no Parameters at all, but only two axes, and awkward to present.

## Consequences

The schema rejects a Parameter named like an Input, duplicate names, a `number` default outside `min`–`max`, and a `choice` default that isn't an option index.
