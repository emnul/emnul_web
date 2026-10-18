import {
  StrictMode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
// Types only: the contract's schemas use Zod, which mustn't ship to the browser.
import type { Parameter } from "../shader-core/contract";
import Controls from "./Controls";
import {
  createShaderRenderer,
  type ParameterValues,
  type ShaderRenderer,
} from "./renderer";

interface Props {
  /** The Shader's `shader.glsl`. */
  source: string;
  /** Seconds `u_time` starts at: the Shader's `still.time`. */
  startTime: number;
  /** The Shader's Parameters, each starting at its default, with a Control for each. */
  parameters: readonly Parameter[];
  /** The Still, shown under the canvas until its first frame covers it. */
  children?: ReactNode;
}

/**
 * A canvas running `source` live over its Still, sized by its container, followed by a Control
 * per Parameter. three.js ships in this island's chunk, so only pages rendering a Shader load it
 * (ADR 0010).
 */
export default function ShaderCanvas(props: Props) {
  // Astro's React integration has no StrictMode option, so each island opts in itself.
  return (
    <StrictMode>
      <Canvas {...props} />
    </StrictMode>
  );
}

// Separate from ShaderCanvas so its effect sits inside the StrictMode boundary.
function Canvas({ source, startTime, parameters, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShaderRenderer>(null);
  const [values, setValues] = useState<ParameterValues>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, p.default])),
  );
  // A renderer made after a Control has moved starts where the Control is.
  const currentValues = useEffectEvent(() => values);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createShaderRenderer(canvas, {
      source,
      startTime,
      values: currentValues(),
    });
    rendererRef.current = renderer;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      renderer.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
    renderer.start();

    return () => {
      rendererRef.current = null;
      observer.disconnect();
      renderer.dispose();
    };
  }, [source, startTime]);

  function change(name: string, value: number) {
    setValues((current) => ({ ...current, [name]: value }));
    rendererRef.current?.setParameter(name, value);
  }

  return (
    <>
      <div className="not-prose relative aspect-video w-full">
        {children}
        <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
      </div>
      {parameters.length > 0 && (
        <Controls
          parameters={parameters}
          values={values}
          onChange={change}
          className="not-prose mt-6"
        />
      )}
    </>
  );
}
