/**
 * A Shader turned into a complete GLSL ES 3.00 fragment shader. `lineOffset` is how many lines
 * precede the author's source, so driver line N is author line N - lineOffset.
 */
export interface PreparedSource {
  fragmentSource: string;
  lineOffset: number;
}

// Declares the Inputs with Shadertoy's names and types, so Shadertoy sources compile unchanged.
const header = [
  "#version 300 es",
  "precision highp float;",
  "precision highp int;",
  "uniform vec3 iResolution;",
  "uniform float iTime;",
  "uniform float iTimeDelta;",
  "uniform int iFrame;",
  "uniform vec4 iMouse;",
  "uniform vec4 iDate;",
  "out vec4 shadertoyFragColor;",
];

const footer = [
  "void main() {",
  "  mainImage(shadertoyFragColor, gl_FragCoord.xy);",
  "}",
];

/** Wraps a Shadertoy-contract `mainImage` source (ADR 0003) into a complete fragment shader. */
export function prepareSource(source: string): PreparedSource {
  return {
    // `source` is joined as one item, so a missing trailing newline can't fuse it with `main`.
    fragmentSource: [...header, source, ...footer].join("\n"),
    lineOffset: header.length,
  };
}
