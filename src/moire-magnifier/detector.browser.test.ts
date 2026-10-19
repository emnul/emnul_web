// The detector's accuracy on the real Shader: each case renders shader.glsl through the renderer
// the page uses, with a known scale error and rotation injected through its Parameters, with and
// without noise or a streak, and checks what the detector reads from the pixels alone. Nothing
// else draws the test images, so the test can't pass against a model of the optics that disagrees
// with the Shader.
import { afterAll, expect, test } from "vitest";
import source from "../content/shaders/moire-magnifier/shader.glsl?raw";
import { createShaderRenderer } from "../renderer/renderer";
import {
  ANALYSIS_SIZE,
  design,
  NOMINAL_SCALE_RATIO,
  tiltedViewAngle,
} from "./design";
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
    noise: 0,
    streak: 0,
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
  /** The noise's standard deviation, as a fraction of white; 0 if left out. */
  noise?: number;
  /** The streak's ink density; 0 if left out. */
  streak?: number;
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

// Noise at the slider's maximum: a standard deviation as large as the whole range from black to
// white. Averaging 4×4 blocks, then the whole frame into each bin of the spectrum, spreads it
// thinly, far below the moiré's peaks, so it barely moves a reading. Both views get the same
// noise, since it depends on the pixel alone.
const NOISE = 1;
const noisy = misregistrations.map((m) => ({ ...m, noise: NOISE }));

// A streak at full density. It isn't periodic, so it adds a line through the spectrum's centre
// rather than a peak; where the line crosses a moiré peak it pulls on it a little.
const streaked = misregistrations.map((m) => ({ ...m, streak: 1 }));

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

/**
 * Renders the two views the page compares on release, one at these values and one tilted from
 * it, and reads them.
 */
function detectAt(values: { viewAngle: number } & Record<string, number>) {
  const tilted = tiltedViewAngle(values.viewAngle);
  return detect(
    [
      { pixels: render(values), viewAngle: values.viewAngle },
      { pixels: render({ ...values, viewAngle: tilted }), viewAngle: tilted },
    ],
    design,
  );
}

/** As `detectAt`, expecting a reading. */
function readAt(values: { viewAngle: number } & Record<string, number>) {
  const reading = detectAt(values);
  if (reading.status !== "ok") {
    throw new Error(`expected a reading, got status "${reading.status}"`);
  }
  return reading;
}

/** Renders a misregistration with an icon and reads it, as the page does on release. */
function read(
  {
    scaleError,
    rotation,
    offset = 0,
    viewAngle = 0,
    noise = 0,
    streak = 0,
  }: Misregistration,
  icon: number,
) {
  return readAt({
    scaleRatio: NOMINAL_SCALE_RATIO * (1 + scaleError),
    rotation,
    offset,
    viewAngle,
    icon,
    noise,
    streak,
  });
}

/** Where the image lies: below a scale ratio of 1 it sinks, above 1 it floats. */
function sideOf(scaleRatio: number) {
  return scaleRatio < 1 ? "sinks" : "floats";
}

function signed(value: number, decimals: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

function name(m: Misregistration) {
  const moved =
    m.offset || m.viewAngle
      ? `, offset ${m.offset ?? 0}, viewing angle ${m.viewAngle ?? 0}°`
      : "";
  const noise = m.noise ? `, noise σ ${m.noise}` : "";
  const streak = m.streak ? `, streak ${m.streak}` : "";
  return `scale error ${signed(m.scaleError * 100, 1)}%, rotation ${signed(m.rotation, 2)}°${moved}${noise}${streak}`;
}

test.for(
  [...misregistrations, ...noisy, ...streaked].flatMap((m) =>
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
  expect(reading.sign).toBe(sideOf(NOMINAL_SCALE_RATIO * (1 + m.scaleError)));
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
// and would read as a smaller scale error; so could a peak of the noise, and pass.
test.for(
  [0, NOISE].flatMap((noise) =>
    [0.99, 0.995, 1.005, 1.01].flatMap((scaleRatio) =>
      icons.map((icon, index) => [scaleRatio, icon, noise, index] as const),
    ),
  ),
)(
  "scale ratio %d, %s, noise σ %d: too near 1 to measure, and fails",
  ([scaleRatio, , noise, icon]) => {
    const reading = detectAt({
      scaleRatio,
      rotation: 0,
      viewAngle: 0,
      icon,
      noise,
    });

    expect(reading.status).toBe("out-of-range");
    expect(reading.pass).toBe(false);
  },
);

/** A scale ratio on either side of 1, out to the Scale ratio Control's ends. */
interface Side {
  scaleRatio: number;
  /** Degrees. */
  rotation: number;
  /** Degrees; 0 if left out. */
  viewAngle?: number;
  /** The noise's standard deviation, as a fraction of white; 0 if left out. */
  noise?: number;
}

// Scale ratios s and s/(2s − 1) are twins: the icon turned over at one draws the same picture as
// at the other, so one view can't tell them apart. 1.0556 is the design's twin, and 0.9545 is
// 1.05's. Rotations stay where the moiré lattice turns less than 45° (see detector.ts), and
// viewing angles reach the Control's ±30°. Every case is far outside the tolerance.
const sides: Side[] = [
  { scaleRatio: 0.9, rotation: 2 },
  { scaleRatio: 0.92, rotation: -1.5, viewAngle: 30 },
  { scaleRatio: 0.9545, rotation: 0.5, viewAngle: -10 },
  { scaleRatio: 0.97, rotation: -0.5 },
  { scaleRatio: 0.98, rotation: 0.25, viewAngle: -30 },
  { scaleRatio: 1.02, rotation: -0.25, viewAngle: 15 },
  { scaleRatio: 1.03, rotation: 0.5 },
  { scaleRatio: 1.05, rotation: -1, viewAngle: -20 },
  { scaleRatio: 1.0556, rotation: 0 },
  { scaleRatio: 1.0556, rotation: 1.5, viewAngle: 30 },
  { scaleRatio: 1.08, rotation: -2 },
  { scaleRatio: 1.1, rotation: 2, viewAngle: -30 },
];

// The sign under noise too, with the same noise in both views.
const noisySides = sides.map((side) => ({ ...side, noise: NOISE }));

function readSide(
  { scaleRatio, rotation, viewAngle = 0, noise = 0 }: Side,
  icon: number,
) {
  return readAt({ scaleRatio, rotation, offset: 0, viewAngle, icon, noise });
}

function nameSide({ scaleRatio, rotation, viewAngle = 0, noise }: Side) {
  return `scale ratio ${scaleRatio}, rotation ${signed(rotation, 2)}°, viewing angle ${viewAngle}°${noise ? `, noise σ ${noise}` : ""}`;
}

test.for(
  [...sides, ...noisySides].flatMap((side) =>
    icons.map(
      (icon, index) =>
        [
          `${nameSide(side)}, ${icon}: ${sideOf(side.scaleRatio)}, reads within ±0.1% and 0.1°, and fails`,
          side,
          index,
        ] as const,
    ),
  ),
)("%s", ([, side, icon]) => {
  const reading = readSide(side, icon);
  const scaleError = side.scaleRatio / NOMINAL_SCALE_RATIO - 1;

  expect(reading.sign).toBe(sideOf(side.scaleRatio));
  expect(reading.scaleError).toBeGreaterThanOrEqual(scaleError - 0.001);
  expect(reading.scaleError).toBeLessThanOrEqual(scaleError + 0.001);
  expect(reading.rotation).toBeGreaterThanOrEqual(side.rotation - 0.1);
  expect(reading.rotation).toBeLessThanOrEqual(side.rotation + 0.1);
  expect(reading.pass).toBe(false);
});

test.for(sides.map((side) => [nameSide(side), side] as const))(
  "%s: every icon gives the same reading, to within 0.05% and 0.05°",
  ([, side]) => {
    const readings = icons.map((_, icon) => readSide(side, icon));
    const spread = (values: number[]) =>
      Math.max(...values) - Math.min(...values);

    expect(new Set(readings.map((r) => r.sign)).size).toBe(1);
    expect(spread(readings.map((r) => r.scaleError))).toBeLessThanOrEqual(
      0.0005,
    );
    expect(spread(readings.map((r) => r.rotation))).toBeLessThanOrEqual(0.05);
  },
);

// Too small a tilt turns the phase too little to read its sign, and too large a one can turn it
// past half a cycle, where it reads as the other sign.
test.for([
  [0, 0],
  [0, 2],
  [-30, 30],
])(
  "views at viewing angles %d° and %d° are refused",
  ([firstAngle, secondAngle]) => {
    const values = { scaleRatio: NOMINAL_SCALE_RATIO, rotation: 0, icon: 0 };
    const first = render({ ...values, viewAngle: firstAngle });
    const second = render({ ...values, viewAngle: secondAngle });

    expect(() =>
      detect(
        [
          { pixels: first, viewAngle: firstAngle },
          { pixels: second, viewAngle: secondAngle },
        ],
        design,
      ),
    ).toThrow(RangeError);
  },
);
