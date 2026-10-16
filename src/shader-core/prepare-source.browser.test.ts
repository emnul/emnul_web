import { expect, test } from "vitest";
import drift from "../content/shaders/drift/shader.glsl?raw";
import { prepareSource } from ".";

const vertexSource = `#version 300 es
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

function compile(gl: WebGL2RenderingContext, type: GLenum, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader returned null");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  // The info log is the failure message, so a compile error shows what the driver reported.
  expect(
    gl.getShaderParameter(shader, gl.COMPILE_STATUS),
    gl.getShaderInfoLog(shader) ?? "",
  ).toBe(true);
  return shader;
}

test("a Shader's prepared source compiles and links in WebGL2", () => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) throw new Error("getContext('webgl2') returned null");

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(
    program,
    // The renderer supplies `#version`, as three.js does for a RawShaderMaterial (ADR 0007).
    compile(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es\n${prepareSource(drift).fragmentSource}`,
    ),
  );
  gl.linkProgram(program);

  expect(
    gl.getProgramParameter(program, gl.LINK_STATUS),
    gl.getProgramInfoLog(program) ?? "",
  ).toBe(true);
});
