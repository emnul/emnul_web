import { afterEach, expect, test } from "vitest";
import {
  createShaderRenderer,
  type ShaderRenderer,
  type ShaderRendererOptions,
} from "./renderer";

// Lights the colour channel `channel` (a `choice` Parameter) at brightness `level` (a `number`
// Parameter), so one pixel shows both values.
const source = `precision highp float;

uniform float level;
uniform int channel;

out vec4 fragColor;

void main() {
    vec3 col = vec3(0.0);
    col[channel] = level;
    fragColor = vec4(col, 1.0);
}
`;

const renderers: ShaderRenderer[] = [];

function renderer(
  options: ShaderRendererOptions,
  canvas = document.createElement("canvas"),
) {
  const created = createShaderRenderer(canvas, options);
  renderers.push(created);
  return created;
}

afterEach(() => {
  for (const created of renderers.splice(0)) created.dispose();
});

/** The RGBA of a 1×1 render. */
function pixel(shader: ShaderRenderer, values?: Record<string, number>) {
  return [...shader.renderPixels(1, 1, values)];
}

test("a Shader renders at the Parameter values it starts with", () => {
  // 0.2 of 255 is 51.
  const shader = renderer({
    source,
    startTime: 0,
    values: { level: 0.2, channel: 1 },
  });

  expect(pixel(shader)).toEqual([0, 51, 0, 255]);
});

test("setting a Parameter changes what the Shader renders", () => {
  const shader = renderer({
    source,
    startTime: 0,
    values: { level: 0.2, channel: 1 },
  });

  shader.setParameter("channel", 2);
  shader.setParameter("level", 1);

  expect(pixel(shader)).toEqual([0, 0, 255, 255]);
});

test("an off-screen render can set Parameters for that render alone", () => {
  const shader = renderer({
    source,
    startTime: 0,
    values: { level: 0.2, channel: 1 },
  });

  expect(pixel(shader, { channel: 0 })).toEqual([51, 0, 0, 255]);
  expect(pixel(shader)).toEqual([0, 51, 0, 255]);
});

test("a name that isn't a Parameter is refused, leaving the Parameters as they were", () => {
  const shader = renderer({
    source,
    startTime: 0,
    values: { level: 0.2, channel: 1 },
  });

  expect(() => shader.renderPixels(1, 1, { level: 1, u_time: 5 })).toThrow(
    '"u_time" is not a Parameter of this Shader',
  );
  expect(() => shader.setParameter("brightness", 1)).toThrow(
    '"brightness" is not a Parameter of this Shader',
  );
  expect(pixel(shader)).toEqual([0, 51, 0, 255]);
});

test("a Shader without Parameters needs no values", () => {
  const shader = renderer({
    source: `precision highp float;
uniform float u_time;
out vec4 fragColor;
void main() {
    fragColor = vec4(u_time, 0.0, 0.0, 1.0);
}
`,
    startTime: 0.2,
  });

  expect(pixel(shader)).toEqual([51, 0, 0, 255]);
});

test("a paused Shader shows a Parameter's new value straight away", () => {
  const canvas = document.createElement("canvas");
  const shader = renderer(
    { source, startTime: 0, values: { level: 0.2, channel: 1 } },
    canvas,
  );
  shader.resize(1, 1);

  shader.setParameter("channel", 0);

  // Copied in the same task as the draw, before the browser clears the drawing buffer.
  const copy = document.createElement("canvas").getContext("2d");
  if (!copy) throw new Error("getContext('2d') returned null");
  copy.drawImage(canvas, 0, 0);
  expect([...copy.getImageData(0, 0, 1, 1).data]).toEqual([51, 0, 0, 255]);
});
