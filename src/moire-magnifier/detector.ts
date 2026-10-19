// Measures the misregistration between a moiré magnifier's lens and icon layers from a render
// alone. It knows the design's pitches, never which icon is drawn: the icon changes how strong
// the moiré's spectral peaks are, never where they sit.
//
// The icon layer at scale ratio s and rotation θ beats against the lens layer into a moiré
// lattice whose fundamental frequency, as a complex number in cycles per pixel, is
// q = (e^{iθ}/s − 1) / lensPitch. So the detector finds ±q, tells which it is, and inverts q:
// 1. luminance, averaged over 4×4 blocks to 256², then a Hann window with its mean removed
// 2. a 256² FFT, and the nearest significant peak to zero frequency: a fundamental, since every
//    other moiré peak is a sum of fundamentals and lies further out. Too near zero to measure,
//    as when the scale ratio is near 1, the reading is out of range.
// 3. a fine search of the exact DFT around that peak, to well under a hundredth of a bin
// 4. q or −q, from how the peak's phase turns between two views a small tilt apart
// 5. e^{iθ}/s = 1 + q·lensPitch
//
// A square lens array makes one view ambiguous. The four fundamentals ±q, ±iq look alike, so the
// detector takes the one within 45° of +x, which is q or −q while the moiré lattice is turned
// less than 45° (|θ| < 2.8° at s = 0.95, less nearer 1). Then q and −q give s on either side of
// 1, and the icon turned over at one draws the same picture as at the other. Tilting tells them
// apart: it moves each lens's focus across the icon layer, which turns q's phase one way and
// −q's the other.
//
// It runs on the CPU after readback, since the site renders each Shader in a single pass
// (ADR 0009).

/** The design a render is checked against, in pixels of the analysed frame. */
export interface Design {
  lensPitch: number;
  /** Over `lensPitch`, the scale ratio as designed. */
  iconPitch: number;
  /** From the lenses to the icon layer, which lies in their focal plane. */
  focalLength: number;
  /** The largest scale error that passes, as a fraction. */
  scaleTolerance: number;
}

/** One render of the Shader. */
export interface View {
  /** RGBA bytes of a 1024² render, bottom row first, as WebGL reads them back. */
  pixels: Uint8Array;
  /** Degrees the viewer has moved to the right of straight on: the Shader's `viewAngle`. */
  viewAngle: number;
}

/**
 * Where the magnified image appears. Below a scale ratio of 1 it sinks: it lies behind the
 * surface, upright, and moves with the viewer. Above 1 it floats: in front of the surface,
 * upside down, moving against the viewer.
 */
export type Sign = "sinks" | "floats";

/** A point in the spectrum, in cycles across the frame, with v counting up the frame. */
export interface Frequency {
  u: number;
  v: number;
}

/** The magnitude spectrum around zero frequency, for display. */
export interface Spectrum {
  /** Bins each side of zero frequency: the spectrum is `2 × radius + 1` bins square. */
  radius: number;
  /**
   * log(1 + magnitude) of each bin, row by row from v = −radius up, each row from u = −radius;
   * zero at zero frequency.
   */
  magnitudes: Float32Array;
}

export type Detection =
  | {
      status: "ok";
      /** The icon pitch over the lens pitch. */
      scaleRatio: number;
      /** How far the scale ratio is from the design's, as a fraction of it. */
      scaleError: number;
      /** Degrees counter-clockwise from the lens layer to the icon layer. */
      rotation: number;
      sign: Sign;
      /** Whether the scale error is within the design's tolerance. */
      pass: boolean;
      /** The moiré peak measured; it and its mirror through zero mark the spectrum. */
      peak: Frequency;
      spectrum: Spectrum;
    }
  | {
      /**
       * No moiré to measure: fewer than 2.5 moiré periods across the frame, as when the scale
       * ratio is near 1, or none at all. That fails.
       */
      status: "out-of-range";
      pass: false;
      spectrum: Spectrum;
    };

/** Side of the square frame analysed, in pixels. */
const FRAME = 1024;
/**
 * The frame is averaged over blocks this size before analysis. The FFT is 16 times smaller and
 * resolves frequency as finely, since the frame's extent is the same. Lens structure (≈171
 * cycles across the frame) folds to 85 or more, out of the band searched; 8 would fold it in.
 */
const BLOCK = 4;
const SIZE = FRAME / BLOCK;
/**
 * The band searched for the moiré peak, in cycles across the frame. It reaches past every peak
 * within the Parameters' ranges, and stops short of the lens structure at 85.
 */
const FURTHEST = 48;
/**
 * The nearest peak that can be measured. A peak's mirror through zero lies twice as far from it,
 * so from here the two, each spread ±2 bins by the window, stay apart. A nearer one is still
 * found, so that one of its harmonics isn't measured in its place.
 */
const NEAREST = 2.5;
/**
 * A peak counts against the band's strongest, its typical (median) bin, and the faintest moiré
 * worth measuring: 1 grey level of amplitude, which a Hann window over SIZE² scales by SIZE²/8.
 */
const SIGNIFICANT_OF_STRONGEST = 0.2;
const SIGNIFICANT_OF_MEDIAN = 10;
const FAINTEST = (1 * SIZE * SIZE) / 8;
/** Bins each side of zero frequency in the spectrum returned for display. */
const SPECTRUM_RADIUS = 32;
/**
 * How far the tilt between the views may move each lens's focus, in icon pitches. The phase
 * turns by that fraction of a cycle, so it must stay clear of zero to have a clear sign, and
 * short of half a cycle, past which it reads as the other sign, at every scale ratio in range.
 */
const LEAST_FOCUS_SHIFT = 0.1;
const MOST_FOCUS_SHIFT = 0.4;

/**
 * Measures the scale error and rotation between the lens and icon layers of the Moiré
 * magnifier, against its design, and whether its image sinks or floats. It reads them from two
 * renders a small tilt apart: it measures the first and returns its spectrum, and the second
 * tells it the sign.
 */
export function detect(
  views: readonly [View, View],
  design: Design,
): Detection {
  const [first, second] = views;
  // How far each lens's focus moves right from the first view to the second. It lies f·tan α
  // left of the lens's centre (see shader.glsl).
  const focusShift =
    design.focalLength *
    (Math.tan(radians(first.viewAngle)) - Math.tan(radians(second.viewAngle)));
  const pitches = Math.abs(focusShift) / design.iconPitch;
  const usable = pitches >= LEAST_FOCUS_SHIFT && pitches <= MOST_FOCUS_SHIFT;
  if (!usable) {
    throw new RangeError(
      `Expected views a tilt apart that moves each lens's focus ${LEAST_FOCUS_SHIFT}–${MOST_FOCUS_SHIFT} icon pitches, got ${pitches.toFixed(3)}`,
    );
  }

  const image = prepare(first.pixels);
  const magnitudes = magnitudeSpectrum(image);
  const spectrum = crop(magnitudes);
  const coarse = coarsePeak(magnitudes);
  if (!coarse || Math.hypot(coarse.u, coarse.v) < NEAREST) {
    return { status: "out-of-range", pass: false, spectrum };
  }

  const peak = refine(image, coarse);
  // The fundamental within 45° of +x: q or −q.
  const [u, v] = towardsX(peak.u, peak.v);
  // The lenses sample the icon layer at their foci, so q's phase is the phase of the icon
  // layer's x frequency there. Moving every focus δ along x turns it by 2π·δ·cos θ / iconPitch,
  // and turns −q's phase as far the other way.
  const [before] = transform(image, [u], [v]);
  const [after] = transform(prepare(second.pixels), [u], [v]);
  const turn = Math.atan2(
    after.im * before.re - after.re * before.im,
    after.re * before.re + after.im * before.im,
  );
  const sign: Sign =
    Math.sign(turn) === Math.sign(focusShift) ? "sinks" : "floats";

  // q in cycles per pixel, then e^{iθ}/s = 1 + q·lensPitch.
  const side = sign === "sinks" ? 1 : -1;
  const re = 1 + (side * u * design.lensPitch) / FRAME;
  const im = (side * v * design.lensPitch) / FRAME;
  const scaleRatio = 1 / Math.hypot(re, im);
  const scaleError = scaleRatio / (design.iconPitch / design.lensPitch) - 1;
  return {
    status: "ok",
    scaleRatio,
    scaleError,
    rotation: (Math.atan2(im, re) * 180) / Math.PI,
    sign,
    pass: Math.abs(scaleError) <= design.scaleTolerance,
    peak,
    spectrum,
  };
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/**
 * Luminance in grey levels averaged over BLOCK² blocks, windowed with its weighted mean removed,
 * as SIZE² values row by row. Row 0 is the frame's bottom, so v counts up the frame as y does in
 * GLSL.
 */
function prepare(pixels: Uint8Array): Float64Array {
  if (pixels.length !== FRAME * FRAME * 4) {
    throw new RangeError(
      `Expected ${FRAME}² RGBA pixels (${FRAME * FRAME * 4} bytes), got ${pixels.length} bytes`,
    );
  }
  const image = new Float64Array(SIZE * SIZE);
  for (let y = 0; y < FRAME; y++) {
    const row = Math.floor(y / BLOCK) * SIZE;
    for (let x = 0; x < FRAME; x++) {
      const i = (y * FRAME + x) * 4;
      image[row + Math.floor(x / BLOCK)] +=
        (0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2]) /
        (BLOCK * BLOCK);
    }
  }

  // Hann, so the frame's edges don't spread every peak across the spectrum.
  const hann = Float64Array.from(
    { length: SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / SIZE),
  );
  // Removing the weighted mean removes the window's spread of it too, which would otherwise
  // reach a bin either side of zero frequency.
  let weights = 0;
  let weighted = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const weight = hann[x] * hann[y];
      weights += weight;
      weighted += weight * image[y * SIZE + x];
    }
  }
  const mean = weighted / weights;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      image[y * SIZE + x] = hann[x] * hann[y] * (image[y * SIZE + x] - mean);
    }
  }
  return image;
}

/** |FFT| of the prepared image, SIZE² bins row by row; index k above SIZE/2 is frequency k − SIZE. */
function magnitudeSpectrum(image: Float64Array): Float64Array {
  const re = Float64Array.from(image);
  const im = new Float64Array(SIZE * SIZE);
  const cos = Float64Array.from({ length: SIZE / 2 }, (_, k) =>
    Math.cos((2 * Math.PI * k) / SIZE),
  );
  const sin = Float64Array.from({ length: SIZE / 2 }, (_, k) =>
    Math.sin((2 * Math.PI * k) / SIZE),
  );
  const lineRe = new Float64Array(SIZE);
  const lineIm = new Float64Array(SIZE);
  // Rows, then columns, each through one line's scratch.
  for (const [stride, step] of [
    [SIZE, 1],
    [1, SIZE],
  ]) {
    for (let line = 0; line < SIZE; line++) {
      const start = line * stride;
      for (let k = 0; k < SIZE; k++) {
        lineRe[k] = re[start + k * step];
        lineIm[k] = im[start + k * step];
      }
      fft(lineRe, lineIm, cos, sin);
      for (let k = 0; k < SIZE; k++) {
        re[start + k * step] = lineRe[k];
        im[start + k * step] = lineIm[k];
      }
    }
  }
  return re.map((value, k) => Math.hypot(value, im[k]));
}

/** In-place radix-2 FFT of a power-of-two length, with the forward sign e^{−2πi}. */
function fft(
  re: Float64Array,
  im: Float64Array,
  cos: Float64Array,
  sin: Float64Array,
) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const half = length >> 1;
    const stride = n / length;
    for (let start = 0; start < n; start += length) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * stride];
        const wi = -sin[k * stride];
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

/** The magnitude at frequency (u, v), either sign. */
function at(magnitudes: Float64Array, u: number, v: number): number {
  return magnitudes[((v + SIZE) % SIZE) * SIZE + ((u + SIZE) % SIZE)];
}

/**
 * The bin of the significant local maximum nearest zero frequency, within FURTHEST, whose
 * quarter-turn is significant too. The moiré lattice is square, so its fundamentals come in
 * quarter-turns; the lens array samples the moiré, and the aliases of a fine icon's high
 * harmonics that this lands near zero frequency don't. The spectrum of a real image mirrors
 * through zero, so only half of it is searched.
 */
function coarsePeak(magnitudes: Float64Array): Frequency | undefined {
  const band: { u: number; v: number; radius: number }[] = [];
  for (let v = 0; v <= FURTHEST; v++) {
    for (let u = -FURTHEST; u <= FURTHEST; u++) {
      if (v === 0 && u <= 0) continue;
      const radius = Math.hypot(u, v);
      if (radius <= FURTHEST) band.push({ u, v, radius });
    }
  }
  const sorted = band
    .map(({ u, v }) => at(magnitudes, u, v))
    .sort((a, b) => a - b);
  const threshold = Math.max(
    SIGNIFICANT_OF_STRONGEST * sorted[sorted.length - 1],
    SIGNIFICANT_OF_MEDIAN * sorted[Math.floor(sorted.length / 2)],
    FAINTEST,
  );
  const neighbours = [-1, 0, 1].flatMap((dv) =>
    [-1, 0, 1].map((du) => [du, dv] as const),
  );
  const isSignificant = (u: number, v: number) =>
    at(magnitudes, u, v) > threshold;
  const isMaximum = (u: number, v: number) =>
    neighbours.every(
      ([du, dv]) => at(magnitudes, u + du, v + dv) <= at(magnitudes, u, v),
    );
  // The quarter-turn of a bin is a bin, within one of the turned peak's own.
  const hasQuarterTurn = (u: number, v: number) =>
    neighbours.some(([du, dv]) => isSignificant(-v + du, u + dv));

  const peaks = band.filter(
    ({ u, v }) =>
      isSignificant(u, v) && isMaximum(u, v) && hasQuarterTurn(u, v),
  );
  const nearest = peaks.reduce<(typeof band)[number] | undefined>(
    (best, bin) =>
      !best ||
      bin.radius < best.radius ||
      (bin.radius === best.radius &&
        at(magnitudes, bin.u, bin.v) > at(magnitudes, best.u, best.v))
        ? bin
        : best,
    undefined,
  );
  return nearest && { u: nearest.u, v: nearest.v };
}

/**
 * The peak of the image's exact DFT near `start`, found by searching ever finer 5×5 grids of
 * frequencies, from half a bin apart down to 0.004.
 */
function refine(image: Float64Array, start: Frequency): Frequency {
  let centre = start;
  for (const step of [0.5, 0.1, 0.02, 0.004]) {
    // Re-centred while the best lies on the grid's edge, so the peak is never outside it.
    for (let moves = 0; moves < 8; moves++) {
      const best = bestOfGrid(image, centre, step);
      centre = best.frequency;
      if (!best.onEdge) break;
    }
  }
  return centre;
}

const GRID = [-2, -1, 0, 1, 2];

/** Of the 5×5 frequencies `step` apart around `centre`, the one where the DFT is strongest. */
function bestOfGrid(image: Float64Array, centre: Frequency, step: number) {
  const us = GRID.map((i) => centre.u + i * step);
  const vs = GRID.map((j) => centre.v + j * step);
  const power = transform(image, us, vs).map(({ re, im }) => re * re + im * im);
  const best = power.indexOf(Math.max(...power));
  const i = best % GRID.length;
  const j = Math.floor(best / GRID.length);
  const last = GRID.length - 1;
  return {
    frequency: { u: us[i], v: vs[j] },
    onEdge: i % last === 0 || j % last === 0,
  };
}

/**
 * The image's exact DFT at each frequency of `us` × `vs`, in cycles across the frame, row by row
 * from the first v.
 */
function transform(
  image: Float64Array,
  us: readonly number[],
  vs: readonly number[],
): { re: number; im: number }[] {
  const twiddles = (frequency: number) => {
    const cos = new Float64Array(SIZE);
    const sin = new Float64Array(SIZE);
    for (let k = 0; k < SIZE; k++) {
      const angle = (-2 * Math.PI * frequency * k) / SIZE;
      cos[k] = Math.cos(angle);
      sin[k] = Math.sin(angle);
    }
    return { cos, sin };
  };
  const uTwiddles = us.map(twiddles);
  const vTwiddles = vs.map(twiddles);

  // Separable: each row's DFT at every u, then down the rows at every v.
  const rowsRe = new Float64Array(SIZE * us.length);
  const rowsIm = new Float64Array(SIZE * us.length);
  for (let y = 0; y < SIZE; y++) {
    for (let i = 0; i < us.length; i++) {
      const { cos, sin } = uTwiddles[i];
      let re = 0;
      let im = 0;
      for (let x = 0; x < SIZE; x++) {
        const value = image[y * SIZE + x];
        re += value * cos[x];
        im += value * sin[x];
      }
      rowsRe[y * us.length + i] = re;
      rowsIm[y * us.length + i] = im;
    }
  }

  return vTwiddles.flatMap(({ cos, sin }) =>
    us.map((_, i) => {
      let re = 0;
      let im = 0;
      for (let y = 0; y < SIZE; y++) {
        const rowRe = rowsRe[y * us.length + i];
        const rowIm = rowsIm[y * us.length + i];
        re += rowRe * cos[y] - rowIm * sin[y];
        im += rowRe * sin[y] + rowIm * cos[y];
      }
      return { re, im };
    }),
  );
}

/** (x, y) turned by a multiple of 90° to lie within 45° of +x. */
function towardsX(x: number, y: number): [number, number] {
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? [x, y] : [-x, -y];
  return y >= 0 ? [y, -x] : [-y, x];
}

/** The magnitudes within SPECTRUM_RADIUS of zero frequency, logged, with zero frequency zeroed. */
function crop(magnitudes: Float64Array): Spectrum {
  const side = 2 * SPECTRUM_RADIUS + 1;
  const cropped = new Float32Array(side * side);
  for (let v = -SPECTRUM_RADIUS; v <= SPECTRUM_RADIUS; v++) {
    for (let u = -SPECTRUM_RADIUS; u <= SPECTRUM_RADIUS; u++) {
      if (u === 0 && v === 0) continue;
      cropped[(v + SPECTRUM_RADIUS) * side + u + SPECTRUM_RADIUS] = Math.log1p(
        at(magnitudes, u, v),
      );
    }
  }
  return { radius: SPECTRUM_RADIUS, magnitudes: cropped };
}
