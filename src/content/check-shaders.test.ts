import { expect, test } from "vitest";
import { assertShadersPass } from "./check-shaders";

const source = `precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`;

test("passes when every Shader passes", () => {
  expect(() =>
    assertShadersPass([{ slug: "fine", source, parameters: [] }]),
  ).not.toThrow();
});

test("throws once, listing every problem with its file and line", () => {
  const stray = source.replace("out vec4", "uniform float speed;\nout vec4");

  expect(() =>
    assertShadersPass([
      { slug: "fine", source, parameters: [] },
      { slug: "broken", source: stray, parameters: [] },
      {
        slug: "missing",
        source,
        parameters: [{ name: "scale", type: "number" }],
      },
    ]),
  ).toThrow(
    [
      "Shader check failed:",
      'src/content/shaders/broken/shader.glsl:2: Uniform "speed" is neither an Input nor a Parameter in the frontmatter',
      'src/content/shaders/missing/index.mdx: Parameter "scale" has no uniform; declare `uniform float scale;`',
    ].join("\n"),
  );
});
