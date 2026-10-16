import { expect, test } from "vitest";
import { prepareSource } from ".";

const source = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}`;

test("each line of the author's source sits lineOffset lines further down the shader", () => {
  const { fragmentSource, lineOffset } = prepareSource(source);
  const shaderLines = fragmentSource.split("\n");

  source.split("\n").forEach((line, index) => {
    // Driver logs number lines from 1, as authors do.
    const authorLine = index + 1;
    expect(shaderLines[authorLine + lineOffset - 1]).toBe(line);
  });
});

test("leaves the #version directive to the renderer", () => {
  // three.js puts its own `#version` and `#define` lines in front of a RawShaderMaterial (ADR 0007).
  expect(prepareSource(source).fragmentSource).not.toMatch(/^\s*#version/m);
});

test("declares every Input with Shadertoy's type", () => {
  const { fragmentSource } = prepareSource(source);

  for (const declaration of [
    "uniform vec3 iResolution;",
    "uniform float iTime;",
    "uniform float iTimeDelta;",
    "uniform int iFrame;",
    "uniform vec4 iMouse;",
    "uniform vec4 iDate;",
  ]) {
    expect(fragmentSource.split("\n")).toContain(declaration);
  }
});
