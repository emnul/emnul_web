// The Moiré magnifier's design: what the detector checks a render against. The page and the
// detector's accuracy test both read it from here. The Shader can't import it, so each value
// mirrors a constant in src/content/shaders/moire-magnifier/shader.glsl or its `index.mdx`; a
// render at the nominal scale ratio reading as anything but no error means the two have drifted.
import type { Design } from "./detector";

/** Side of the square frame the detector analyses, in pixels: `ANALYSIS_SIZE` in shader.glsl. */
export const ANALYSIS_SIZE = 1024;

/** Lens pitch in pixels of the analysed frame: `LENS_PITCH` in shader.glsl. */
const LENS_PITCH = 6;

/** The lenses' focal length in pixels of the analysed frame: `FOCAL_LENGTH` in shader.glsl. */
const FOCAL_LENGTH = 6;

/** Icon pitch over lens pitch as designed: the default of `scaleRatio` in index.mdx. */
export const NOMINAL_SCALE_RATIO = 0.95;

export const design: Design = {
  lensPitch: LENS_PITCH,
  // shader.glsl draws icons at `scaleRatio * LENS_PITCH`.
  iconPitch: NOMINAL_SCALE_RATIO * LENS_PITCH,
  focalLength: FOCAL_LENGTH,
  scaleTolerance: 0.004,
};

/**
 * Degrees between the two views the detector compares. From any viewing angle in the Control's
 * range it moves each lens's focus 0.24 to 0.29 icon pitches, inside the range the detector
 * accepts.
 */
const VIEW_TILT = 13;

/**
 * The viewing angle of the view the detector compares with one at `viewAngle`: `VIEW_TILT`
 * nearer straight on, so it stays within the Viewing angle Control's ±30°.
 */
export function tiltedViewAngle(viewAngle: number): number {
  return viewAngle - Math.sign(viewAngle || 1) * VIEW_TILT;
}
