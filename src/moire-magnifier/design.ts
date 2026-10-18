// The Moiré magnifier's design: what the detector checks a render against. The page and the
// detector's accuracy test both read it from here. The Shader can't import it, so each value
// mirrors a constant in src/content/shaders/moire-magnifier/shader.glsl or its `index.mdx`; a
// render at the nominal scale ratio reading as anything but no error means the two have drifted.
import type { Design } from "./detector";

/** Side of the square frame the detector analyses, in pixels: `ANALYSIS_SIZE` in shader.glsl. */
export const ANALYSIS_SIZE = 1024;

/** Lens pitch in pixels of the analysed frame: `LENS_PITCH` in shader.glsl. */
const LENS_PITCH = 6;

/** Icon pitch over lens pitch as designed: the default of `scaleRatio` in index.mdx. */
export const NOMINAL_SCALE_RATIO = 0.95;

export const design: Design = {
  lensPitch: LENS_PITCH,
  // shader.glsl draws icons at `scaleRatio * LENS_PITCH`.
  iconPitch: NOMINAL_SCALE_RATIO * LENS_PITCH,
  scaleTolerance: 0.004,
};
