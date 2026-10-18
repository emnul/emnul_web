// The detector's accuracy on the real Shader: each case renders shader.glsl through the renderer
// the page uses, with a known scale error and rotation injected through its Parameters, and
// checks what the detector reads from the pixels alone. Nothing else draws the test images, so
// the test can't pass against a model of the optics that disagrees with the Shader.
import { afterAll, expect, test } from "vitest";
import source from "../content/shaders/moire-magnifier/shader.glsl?raw";
import { createShaderRenderer } from "../renderer/renderer";
import { ANALYSIS_SIZE, design, NOMINAL_SCALE_RATIO } from "./design";
import { detect } from "./detector";

// The `icon` Parameter's options, by index.
const icons = ["Letter", "Star", "Lines"];

// Never started, so every render is at `u_time` 0.
const renderer = createShaderRenderer(document.createElement("canvas"), {
  source,
  startTime: 0,
  values: {
    scaleRatio: NOMINAL_SCALE_RATIO,
    rotation: 0,
    offset: 0,
    viewAngle: 0,
    icon: 0,
  },
});

afterAll(() => renderer.dispose());

/** What a case injects through the Shader's Parameters, and whether that should pass. */
interface Misregistration {
  /** Injected as a scale ratio of `NOMINAL_SCALE_RATIO × (1 + scaleError)`. */
  scaleError: number;
  /** Degrees. */
  rotation: number;
  /** Icon pitches; 0 if left out. */
  offset?: number;
  /** Degrees; 0 if left out. */
  viewAngle?: number;
  pass: boolean;
}

// Scale errors stay at least 0.2% from the ±0.4% tolerance, twice the accuracy asked for, so
// pass or fail never hangs on the last digit. Rotations stay within the ±2° the slider allows.
const misregistrations: Misregistration[] = [
  { scaleError: 0, rotation: 0, pass: true },
  { scaleError: 0.002, rotation: 0, pass: true },
  { scaleError: -0.002, rotation: 0, pass: true },
  { scaleError: 0.006, rotation: 0, pass: false },
  { scaleError: -0.006, rotation: 0, pass: false },
  { scaleError: 0.03, rotation: 0, pass: false },
  { scaleError: -0.05, rotation: 0, pass: false },
  { scaleError: 0, rotation: 0.5, pass: true },
  { scaleError: 0.002, rotation: -1.5, pass: true },
  { scaleError: -0.002, rotation: 2, pass: true },
  { scaleError: 0.006, rotation: 1, pass: false },
  { scaleError: -0.006, rotation: -2, pass: false },
  { scaleError: 0.02, rotation: 1, pass: false },
  { scaleError: -0.05, rotation: -2, pass: false },
  // Offset and viewing angle move the image without changing its size or turn.
  { scaleError: 0.002, rotation: 0.75, offset: 0.3, viewAngle: 12, pass: true },
  {
    scaleError: -0.006,
    rotation: -0.4,
    offset: 0.8,
    viewAngle: -25,
    pass: false,
  },
];

/** Renders the Shader at these Parameter values, the rest as they started. */
function render(values: Record<string, number>) {
  const pixels = renderer.renderPixels(ANALYSIS_SIZE, ANALYSIS_SIZE, values);
  // three.js logs a compile error rather than throwing, and the failed render is one colour.
  expect(
    pixels.some((byte, index) => byte !== pixels[index % 4]),
    "the Shader rendered one colour; see the console for a compile error",
  ).toBe(true);
  return pixels;
}

/** Renders a misregistration with an icon and reads it, as the page does on release. */
function read(
  { scaleError, rotation, offset = 0, viewAngle = 0 }: Misregistration,
  icon: number,
) {
  const pixels = render({
    scaleRatio: NOMINAL_SCALE_RATIO * (1 + scaleError),
    rotation,
    offset,
    viewAngle,
    icon,
  });
  const reading = detect([{ pixels }], design);
  if (reading.status !== "ok") {
    throw new Error(`expected a reading, got status "${reading.status}"`);
  }
  return reading;
}

function signed(value: number, decimals: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function name(m: Misregistration) {
  const moved =
    m.offset || m.viewAngle
      ? `, offset ${m.offset ?? 0}, viewing angle ${m.viewAngle ?? 0}°`
      : "";
  return `scale error ${signed(m.scaleError * 100, 1)}%, rotation ${signed(m.rotation, 2)}°${moved}`;
}

test.for(
  misregistrations.flatMap((m) =>
    icons.map(
      (icon, index) =>
        [
          `${name(m)}, ${icon}: reads within ±0.1% and 0.1°, and ${m.pass ? "passes" : "fails"}`,
          m,
          index,
        ] as const,
    ),
  ),
)("%s", ([, m, icon]) => {
  const reading = read(m, icon);

  expect(reading.scaleError).toBeGreaterThanOrEqual(m.scaleError - 0.001);
  expect(reading.scaleError).toBeLessThanOrEqual(m.scaleError + 0.001);
  expect(reading.rotation).toBeGreaterThanOrEqual(m.rotation - 0.1);
  expect(reading.rotation).toBeLessThanOrEqual(m.rotation + 0.1);
  expect(reading.pass).toBe(m.pass);
});

// The icons differ only in where the moiré's peaks are strong, so the readings differ only by
// how much the peaks' neighbours pull on them: far less than the accuracy asked for.
test.for(misregistrations.map((m) => [name(m), m] as const))(
  "%s: every icon gives the same reading, to within 0.05% and 0.05°",
  ([, m]) => {
    const readings = icons.map((_, icon) => read(m, icon));
    const spread = (values: number[]) =>
      Math.max(...values) - Math.min(...values);

    expect(spread(readings.map((r) => r.scaleError))).toBeLessThanOrEqual(
      0.0005,
    );
    expect(spread(readings.map((r) => r.rotation))).toBeLessThanOrEqual(0.05);
    expect(new Set(readings.map((r) => r.pass)).size).toBe(1);
  },
);

// Fewer than 2.5 moiré periods across the frame. A harmonic further out could still be found,
// and would read as a smaller scale error.
test.for(
  [0.99, 0.995, 1.005, 1.01].flatMap((scaleRatio) =>
    icons.map((icon, index) => [scaleRatio, icon, index] as const),
  ),
)(
  "scale ratio %d, %s: too near 1 to measure, and fails",
  ([scaleRatio, , icon]) => {
    const reading = detect(
      [{ pixels: render({ scaleRatio, rotation: 0, icon }) }],
      design,
    );

    expect(reading.status).toBe("out-of-range");
    expect(reading.pass).toBe(false);
  },
);
