import { expect, test } from "vitest";
import { checkSource } from "./check-source";

const valid = `precision highp float;

// uniform float commentedOut;
uniform vec2 u_resolution;
uniform float u_time;
uniform float scaleRatio,
  rotation;
uniform int icon;

out vec4 fragColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    fragColor = vec4(uv * scaleRatio, float(icon) + rotation + u_time, 1.0);
}`;

const parameters = [
  { name: "scaleRatio", type: "number" },
  { name: "rotation", type: "number" },
  { name: "icon", type: "choice" },
] as const;

test("a source declaring Inputs and its Parameters passes, listing each uniform at its line", () => {
  expect(checkSource(valid, parameters)).toEqual({
    errors: [],
    uniforms: [
      { name: "u_resolution", type: "vec2", line: 4 },
      { name: "u_time", type: "float", line: 5 },
      { name: "scaleRatio", type: "float", line: 6 },
      { name: "rotation", type: "float", line: 7 },
      { name: "icon", type: "int", line: 8 },
    ],
  });
});

test("Inputs are optional", () => {
  const source = `precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`;
  expect(checkSource(source, []).errors).toEqual([]);
});

test("a #version inside a comment is not a directive", () => {
  expect(
    checkSource(`/*\n#version 300 es\n*/\n${valid}`, parameters).errors,
  ).toEqual([]);
});

test.each([
  {
    case: "a syntax error, at the author's line",
    source: valid.replace("vec2 uv =", "vec2 uv = ="),
    line: 13,
    message: /Expected/,
  },
  {
    case: "a #version directive",
    source: `#version 300 es\n${valid}`,
    line: 1,
    message: /#version/,
  },
  {
    case: "a uniform that is neither an Input nor a Parameter",
    source: valid.replace(
      "uniform int icon;",
      "uniform int icon;\nuniform float speed;",
    ),
    line: 9,
    message: /"speed" is neither an Input nor a Parameter/,
  },
  {
    case: "a sampler",
    source: valid.replace(
      "uniform int icon;",
      "uniform int icon;\nuniform sampler2D tex;",
    ),
    line: 9,
    message: /single-pass/,
  },
  {
    case: "an integer sampler",
    source: valid.replace(
      "uniform int icon;",
      "uniform int icon;\nuniform isampler2D tex;",
    ),
    line: 9,
    message: /single-pass/,
  },
  {
    case: "an array uniform",
    source: valid.replace("uniform int icon;", "uniform int icon[3];"),
    line: 8,
    message: /"icon" must not be an array/,
  },
  {
    case: "an array uniform declared on its type",
    source: valid.replace("uniform int icon;", "uniform int[3] icon;"),
    line: 8,
    message: /"icon" must not be an array/,
  },
  {
    case: "a uniform block",
    source: valid.replace(
      "uniform int icon;",
      "uniform int icon;\nuniform Extra { float speed; };",
    ),
    line: 9,
    message: /Uniform block "Extra" isn't supported/,
  },
  {
    case: "an Input with the wrong type",
    source: valid.replace(
      "uniform vec2 u_resolution;",
      "uniform vec3 u_resolution;",
    ),
    line: 4,
    message: /"u_resolution" must be declared as vec2, not vec3/,
  },
  {
    case: "a Parameter with the wrong type for its Parameter type",
    source: valid.replace("uniform int icon;", "uniform float icon;"),
    line: 8,
    message: /"icon" must be declared as int, not float/,
  },
])("reports $case", ({ source, line, message }) => {
  const { errors } = checkSource(source, parameters);
  expect(errors).toHaveLength(1);
  expect(errors[0]?.line).toBe(line);
  expect(errors[0]?.message).toMatch(message);
});

test("reports a Parameter with no uniform, without a line", () => {
  const { errors } = checkSource(valid, [
    ...parameters,
    { name: "offset", type: "number" },
  ]);
  expect(errors).toEqual([
    {
      message:
        'Parameter "offset" has no uniform; declare `uniform float offset;`',
    },
  ]);
});
