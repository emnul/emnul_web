import { expect, test } from "vitest";
import type { Parameter } from "./contract";
import { checkShaderSources } from "./shaders";

const passing = `precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(1.0); }`;

/** A Shader's collection entry, reduced to what the check reads. */
function shader(id: string, parameters: Parameter[] = []) {
  return { id, data: { parameters } };
}

/** Keys each file by its path in the Shader's directory, as `import.meta.glob` does. */
function byPath<File>(filesBySlug: Record<string, File>, file = "shader.glsl") {
  return Object.fromEntries(
    Object.entries(filesBySlug).map(([slug, contents]) => [
      `/src/content/shaders/${slug}/${file}`,
      contents,
    ]),
  );
}

/** A rendered `still.png` for each slug, standing in for its image metadata. */
function stills(...slugs: string[]) {
  return byPath(
    Object.fromEntries(slugs.map((slug) => [slug, `${slug} still`])),
    "still.png",
  );
}

test("returns each Shader with its source when every Shader passes", () => {
  const other = passing.replace("1.0", "0.5");

  expect(
    checkShaderSources(
      [shader("drift"), shader("tide")],
      byPath({ drift: passing, tide: other }),
      stills("drift", "tide"),
    ),
  ).toEqual([
    { shader: shader("drift"), source: passing, still: "drift still" },
    { shader: shader("tide"), source: other, still: "tide still" },
  ]);
});

test("reports a problem in shader.glsl at its line", () => {
  const stray = passing.replace("out vec4", "uniform float speed;\nout vec4");

  expect(() =>
    checkShaderSources(
      [shader("drift")],
      byPath({ drift: stray }),
      stills("drift"),
    ),
  ).toThrow(
    new Error(
      [
        "Shader check failed:",
        'src/content/shaders/drift/shader.glsl:2: Uniform "speed" is neither an Input nor a Parameter in the frontmatter',
      ].join("\n"),
    ),
  );
});

const scale: Parameter = {
  type: "number",
  name: "scale",
  label: "Scale",
  default: 1,
  min: 0,
  max: 2,
  step: 0.1,
};

test("reports a Parameter with no uniform at the Shader's index.mdx", () => {
  expect(() =>
    checkShaderSources(
      [shader("drift", [scale])],
      byPath({ drift: passing }),
      stills("drift"),
    ),
  ).toThrow(
    new Error(
      [
        "Shader check failed:",
        'src/content/shaders/drift/index.mdx: Parameter "scale" has no uniform; declare `uniform float scale;`',
      ].join("\n"),
    ),
  );
});

test("reports a Shader with no shader.glsl alongside every other problem", () => {
  expect(() =>
    checkShaderSources(
      [shader("drift", [scale]), shader("nope")],
      byPath({ drift: passing }),
      stills("drift", "nope"),
    ),
  ).toThrow(
    new Error(
      [
        "Shader check failed:",
        'src/content/shaders/drift/index.mdx: Parameter "scale" has no uniform; declare `uniform float scale;`',
        "src/content/shaders/nope/shader.glsl: missing; each Shader directory needs one",
      ].join("\n"),
    ),
  );
});

test("reports a shader.glsl that no Shader's index.mdx sits next to", () => {
  expect(() =>
    checkShaderSources(
      [shader("drift")],
      byPath({ drift: passing, orphan: passing }),
      stills("drift"),
    ),
  ).toThrow(
    new Error(
      [
        "Shader check failed:",
        "src/content/shaders/orphan/index.mdx: missing; shader.glsl has no Shader",
      ].join("\n"),
    ),
  );
});

test("fails when the collection has no Shaders, as a wrong loader path would leave it", () => {
  expect(() =>
    checkShaderSources([], byPath({ drift: passing }), stills()),
  ).toThrow(new Error("No Shaders found under src/content/shaders/"));
});

test("reports a Shader whose Still hasn't been rendered", () => {
  expect(() =>
    checkShaderSources(
      [shader("drift"), shader("tide")],
      byPath({ drift: passing, tide: passing }),
      stills("drift"),
    ),
  ).toThrow(
    new Error(
      [
        "Shader check failed:",
        "src/content/shaders/tide/still.png: missing; run `bun run stills`",
      ].join("\n"),
    ),
  );
});
