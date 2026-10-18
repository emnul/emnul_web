// Draws one Shader with three.js (ADR 0010): a fullscreen plane with a `RawShaderMaterial`
// whose fragment shader is the Shader's raw `shader.glsl` (ADR 0009). three.js supplies the
// `#version 300 es` line. The renderer supplies the Inputs each frame:
// - `u_resolution`: pixels of whatever is being drawn to, the canvas or an off-screen target
// - `u_time`: seconds the Shader has been running, not counting time spent paused
import {
  GLSL3,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";

// The plane spans clip space, so no camera matrices are needed.
const vertexShader = `in vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export interface ShaderRenderer {
  /** Runs the frame loop, continuing `u_time` from where it was paused. */
  start(): void;
  /** Stops the frame loop and freezes `u_time`. */
  pause(): void;
  /** Sizes the canvas in CSS pixels; it renders at `width × height × pixel ratio` pixels. */
  resize(width: number, height: number): void;
  /**
   * Renders one frame to an off-screen target of `width × height` pixels and reads it back as
   * RGBA bytes, bottom row first as WebGL reads them.
   */
  renderPixels(width: number, height: number): Uint8Array;
  /** Stops the loop and releases every WebGL resource, including the context. */
  dispose(): void;
}

/** A renderer drawing `source`, a Shader's `shader.glsl`, into `canvas`. */
export function createShaderRenderer(
  canvas: HTMLCanvasElement,
  source: string,
): ShaderRenderer {
  const webgl = new WebGLRenderer({ canvas });

  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader: source,
    uniforms: {
      u_resolution: { value: new Vector2() },
      u_time: { value: 0 },
    },
  });
  const geometry = new PlaneGeometry(2, 2);
  const scene = new Scene().add(new Mesh(geometry, material));
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Seconds run before the current start, and when that start happened.
  let runSeconds = 0;
  let startedAt: number | undefined;
  const elapsed = () =>
    runSeconds +
    (startedAt === undefined ? 0 : (performance.now() - startedAt) / 1000);

  // Draws to the current target, which `u_resolution` must already describe.
  function draw() {
    material.uniforms.u_time.value = elapsed();
    webgl.render(scene, camera);
  }

  function render() {
    webgl.getDrawingBufferSize(material.uniforms.u_resolution.value);
    draw();
  }

  return {
    start() {
      if (startedAt !== undefined) return;
      startedAt = performance.now();
      webgl.setAnimationLoop(render);
    },
    pause() {
      if (startedAt === undefined) return;
      runSeconds = elapsed();
      startedAt = undefined;
      webgl.setAnimationLoop(null);
    },
    resize(width, height) {
      // Read each time, since zoom or moving to another screen changes it (ADR 0010: full ratio).
      webgl.setPixelRatio(window.devicePixelRatio);
      webgl.setSize(width, height, false);
      // A paused Shader would otherwise show a stretched frame until it's started again.
      if (startedAt === undefined) render();
    },
    renderPixels(width, height) {
      const target = new WebGLRenderTarget(width, height);
      const pixels = new Uint8Array(width * height * 4);
      try {
        material.uniforms.u_resolution.value.set(width, height);
        webgl.setRenderTarget(target);
        draw();
        webgl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      } finally {
        webgl.setRenderTarget(null);
        target.dispose();
      }
      return pixels;
    },
    dispose() {
      webgl.setAnimationLoop(null);
      startedAt = undefined;
      geometry.dispose();
      material.dispose();
      webgl.dispose();
      // Browsers cap live WebGL contexts, so give this one back now rather than at GC.
      webgl.forceContextLoss();
    },
  };
}
