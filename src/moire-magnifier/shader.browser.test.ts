// The Moiré magnifier's optional defects, rendered from the real shader.glsl through the renderer
// the page uses, at the 1024² frame the detector analyses.
import { afterAll, expect, test } from "vitest";
import source from "../content/shaders/moire-magnifier/shader.glsl?raw";
import { createShaderRenderer } from "../renderer/renderer";
import { ANALYSIS_SIZE, NOMINAL_SCALE_RATIO } from "./design";

// Each Parameter at its default in index.mdx. Never started, so every render is at `u_time` 0.
const renderer = createShaderRenderer(document.createElement("canvas"), {
  source,
  startTime: 0,
  values: {
    scaleRatio: NOMINAL_SCALE_RATIO,
    rotation: 0,
    offset: 0,
    viewAngle: 0,
    icon: 0,
    noise: 0,
  },
});

afterAll(() => renderer.dispose());

function render(values: Record<string, number> = {}) {
  return renderer.renderPixels(ANALYSIS_SIZE, ANALYSIS_SIZE, values);
}

/** Mean and standard deviation of `after − before`, over every colour channel of every pixel. */
function difference(before: Uint8Array, after: Uint8Array) {
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (let i = 0; i < before.length; i++) {
    if (i % 4 === 3) continue;
    const d = after[i] - before[i];
    sum += d;
    squares += d * d;
    count++;
  }
  const mean = sum / count;
  return { mean, deviation: Math.sqrt(squares / count - mean * mean) };
}

/**
 * The fraction of lenses whose pixels all share one colour. At 1024² each lens covers exactly
 * 6×6 pixels, and one lens is centred on the frame, so they start at pixel 509 = 512 − 3.
 */
function flatLenses(pixels: Uint8Array) {
  const pitch = 6;
  const first = (ANALYSIS_SIZE / 2 - pitch / 2) % pitch;
  let lenses = 0;
  let flat = 0;
  for (let y = first; y + pitch <= ANALYSIS_SIZE; y += pitch) {
    for (let x = first; x + pitch <= ANALYSIS_SIZE; x += pitch) {
      lenses++;
      const corner = (y * ANALYSIS_SIZE + x) * 4;
      let same = true;
      for (let dy = 0; dy < pitch && same; dy++) {
        for (let dx = 0; dx < pitch && same; dx++) {
          const i = ((y + dy) * ANALYSIS_SIZE + x + dx) * 4;
          for (let c = 0; c < 3; c++) {
            if (pixels[i + c] !== pixels[corner + c]) same = false;
          }
        }
      }
      if (same) flat++;
    }
  }
  return flat / lenses;
}

test("noise adds grey noise of the standard deviation it's set to, as a fraction of white", () => {
  // 0.02 of 255 is 5.1 grey levels, small enough that paper rarely clips at white.
  const noise = difference(render(), render({ noise: 0.02 }));

  // Unbiased, up to the half grey level that rounding to bytes can move the render without it.
  expect(Math.abs(noise.mean)).toBeLessThan(0.5);
  expect(noise.deviation).toBeGreaterThan(5.1 * 0.95);
  expect(noise.deviation).toBeLessThan(5.1 * 1.05);
});

test("with noise off every lens shows one colour, and with it on almost none do", () => {
  expect(flatLenses(render())).toBe(1);
  expect(flatLenses(render({ noise: 0.02 }))).toBeLessThan(0.01);
});

test("noise is the same every time a frame renders", () => {
  expect(render({ noise: 0.1 })).toEqual(render({ noise: 0.1 }));
});
