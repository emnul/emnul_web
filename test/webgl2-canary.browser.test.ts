import { expect, test } from "vitest";

// Proves the browser-test environment can run WebGL2 before the renderer exists:
// a fullscreen triangle with a constant colour must compile and link.
const vertexSource = `#version 300 es
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(1.0, 0.0, 1.0, 1.0);
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

test("a WebGL2 context compiles and links a trivial program", () => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) throw new Error("getContext('webgl2') returned null");
  expect(gl).toBeInstanceOf(WebGL2RenderingContext);

  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);

  expect(
    gl.getProgramParameter(program, gl.LINK_STATUS),
    gl.getProgramInfoLog(program) ?? "",
  ).toBe(true);
});
