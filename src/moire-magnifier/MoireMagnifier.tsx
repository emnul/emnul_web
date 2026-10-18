import { StrictMode, useState } from "react";
import type { ParameterValues, ShaderRenderer } from "../renderer/renderer";
import { LiveShader, type ShaderCanvasProps } from "../renderer/ShaderCanvas";
import { ANALYSIS_SIZE, design, NOMINAL_SCALE_RATIO } from "./design";
import { detect } from "./detector";
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
 * Renders the frame the detector analyses, at these values, and reads it. Synchronous, so the
 * live canvas can't draw in between, and `u_time` is the same throughout.
 */
function measure(renderer: ShaderRenderer, values: ParameterValues): Reading {
  const started = performance.now();
  const pixels = renderer.renderPixels(ANALYSIS_SIZE, ANALYSIS_SIZE, values);
  const detection = detect([{ pixels }], design);
  return {
    // Named as in the Shader's index.mdx.
    truth: {
      scaleError: values.scaleRatio / NOMINAL_SCALE_RATIO - 1,
      rotation: values.rotation,
    },
    detection,
    milliseconds: performance.now() - started,
  };
}
