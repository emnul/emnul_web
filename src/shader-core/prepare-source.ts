/**
 * A Shader's GLSL source turned into a GLSL ES 3.00 fragment shader, minus the `#version` directive, which the
 * renderer supplies (ADR 0007). `lineOffset` is how many lines the core puts before the author's
 * source; the renderer adds whatever it puts in front before mapping driver lines to author lines.
 */
export interface PreparedSource {
  fragmentSource: string;
  lineOffset: number;
}

// Declares the Inputs with Shadertoy's names and types, so Shadertoy sources compile unchanged.
const header = [
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

/** Wraps a Shadertoy-contract `mainImage` source (ADR 0003) into a fragment shader. */
export function prepareSource(source: string): PreparedSource {
  return {
    // `source` is joined as one item, so a missing trailing newline can't fuse it with `main`.
    fragmentSource: [...header, source, ...footer].join("\n"),
    lineOffset: header.length,
  };
}
