import { beforeEach, expect, test, vi } from "vitest";
import type { Parameter } from "../shader-core/contract";
import { checkedShaders } from "./shaders";

// The fake collection; the GLSL still comes from the real files, so only `drift` has a source.
const entries = vi.hoisted(() => ({
  current: [] as { id: string; data: { parameters: Parameter[] } }[],
}));

vi.mock("astro:content", () => ({
  getCollection: async () => entries.current,
}));

beforeEach(() => {
  entries.current = [{ id: "drift", data: { parameters: [] } }];
});

test("returns each Shader with its source when every Shader passes", async () => {
  const shaders = await checkedShaders();

  expect(shaders.map(({ shader }) => shader.id)).toEqual(["drift"]);
  expect(shaders[0]?.source).toMatch(/^precision highp float;/);
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

test("reports a Parameter with no uniform at the Shader's index.mdx", async () => {
  entries.current = [{ id: "drift", data: { parameters: [scale] } }];

  await expect(checkedShaders()).rejects.toThrow(
    [
      "Shader check failed:",
      'src/content/shaders/drift/index.mdx: Parameter "scale" has no uniform; declare `uniform float scale;`',
    ].join("\n"),
  );
});

test("reports a Shader with no shader.glsl alongside every other problem", async () => {
  entries.current = [
    { id: "drift", data: { parameters: [scale] } },
    { id: "nope", data: { parameters: [] } },
  ];

  await expect(checkedShaders()).rejects.toThrow(
    new Error(
      [
        "Shader check failed:",
        'src/content/shaders/drift/index.mdx: Parameter "scale" has no uniform; declare `uniform float scale;`',
        "src/content/shaders/nope/shader.glsl: missing; each Shader folder needs one",
      ].join("\n"),
    ),
  );
});

test("reports a shader.glsl that no Shader's index.mdx sits next to", async () => {
  entries.current = [{ id: "nope", data: { parameters: [] } }];

  await expect(checkedShaders()).rejects.toThrow(
    new Error(
      [
        "Shader check failed:",
        "src/content/shaders/nope/shader.glsl: missing; each Shader folder needs one",
        "src/content/shaders/drift/index.mdx: missing; shader.glsl has no Shader",
      ].join("\n"),
    ),
  );
});

test("fails when the collection has no Shaders, as a wrong loader path would leave it", async () => {
  entries.current = [];

  await expect(checkedShaders()).rejects.toThrow(
    new Error("No Shaders found under src/content/shaders/"),
  );
});
