import { StrictMode, useState } from "react";
import type { ParameterValues, ShaderRenderer } from "../renderer/renderer";
import { LiveShader, type ShaderCanvasProps } from "../renderer/ShaderCanvas";
import {
  ANALYSIS_SIZE,
  design,
  NOMINAL_SCALE_RATIO,
  tiltedViewAngle,
} from "./design";
import { detect, type Sign, type View } from "./detector";
import DetectorPanel, { type Reading } from "./DetectorPanel";

/**
 * The Moiré magnifier's island: the Shader and its Controls, as on any Shader page, and the
 * detector's panel, which needs the same renderer. Its own island, so the detector loads on this
 * page alone.
 */
export default function MoireMagnifier(props: ShaderCanvasProps) {
  return (
    <StrictMode>
      <Magnifier {...props} />
    </StrictMode>
  );
}

function Magnifier(props: ShaderCanvasProps) {
  const [reading, setReading] = useState<Reading>();
  return (
    <LiveShader
      {...props}
      onSettle={(renderer, values) => setReading(measure(renderer, values))}
      panel={
        <DetectorPanel reading={reading} tolerance={design.scaleTolerance} />
      }
    />
  );
}

/**
 * Renders the two views the detector compares, at these values and tilted from them, and reads
 * them. Synchronous, so the live canvas can't draw in between, and `u_time` is the same
 * throughout.
 */
function measure(renderer: ShaderRenderer, values: ParameterValues): Reading {
  const started = performance.now();
  const view = (viewAngle: number): View => ({
    pixels: renderer.renderPixels(ANALYSIS_SIZE, ANALYSIS_SIZE, {
      ...values,
      viewAngle,
    }),
    viewAngle,
  });
  const detection = detect(
    [view(values.viewAngle), view(tiltedViewAngle(values.viewAngle))],
    design,
  );
  return {
    // Named as in the Shader's index.mdx.
    truth: {
      scaleError: values.scaleRatio / NOMINAL_SCALE_RATIO - 1,
      rotation: values.rotation,
      sign: signOf(values.scaleRatio),
    },
    detection,
    milliseconds: performance.now() - started,
  };
}

/** Whether the image sinks or floats at this scale ratio; at exactly 1 it does neither. */
function signOf(scaleRatio: number): Sign | undefined {
  if (scaleRatio < 1) return "sinks";
  if (scaleRatio > 1) return "floats";
  return undefined;
}
