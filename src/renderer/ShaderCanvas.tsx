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

export interface ShaderCanvasProps {
  /** The Shader's `shader.glsl`. */
  source: string;
  /** Seconds `u_time` starts at: the Shader's `still.time`. */
  startTime: number;
  /** The Shader's Parameters, each starting at its default, with a Control for each. */
  parameters: readonly Parameter[];
  /** The Still, shown under the canvas until its first frame covers it. */
  children?: ReactNode;
}

export interface LiveShaderProps extends ShaderCanvasProps {
  /**
   * Called with the renderer and the Parameter values once they settle: shortly after the
   * Shader starts, and after each change the visitor finishes, never mid-drag. For work too slow
   * to repeat on every change, such as measuring an off-screen render.
   */
  onSettle?: (renderer: ShaderRenderer, values: ParameterValues) => void;
  /** Shown after the Controls, such as what `onSettle` measured. */
  panel?: ReactNode;
}

/**
 * How long values must stay put after a finished change before they settle, so a held arrow
 * key, which finishes a change on every repeat, settles once.
 */
const SETTLE_DELAY_MS = 150;

/**
 * A canvas running `source` live over its Still, sized by its container, followed by a Control
 * per Parameter. three.js ships in this island's chunk, so only pages rendering a Shader load it
 * (ADR 0010).
 */
export default function ShaderCanvas(props: ShaderCanvasProps) {
  // Astro's React integration has no StrictMode option, so each island opts in itself.
  return (
    <StrictMode>
      <LiveShader {...props} />
    </StrictMode>
  );
}

/**
 * ShaderCanvas's content, for an island that adds to it, such as a panel measuring the Shader's
 * renders. It goes inside the island's StrictMode boundary.
 */
export function LiveShader({
  source,
  startTime,
  parameters,
  children,
  onSettle,
  panel,
}: LiveShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ShaderRenderer>(null);
  const [values, setValues] = useState<ParameterValues>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, p.default])),
  );
  // A renderer made after a Control has moved starts where the Control is.
  const currentValues = useEffectEvent(() => values);
  // Counts the changes the visitor has finished, so each one restarts the wait to settle.
  const [finished, setFinished] = useState(0);
  const settle = useEffectEvent(() => {
    const renderer = rendererRef.current;
    if (renderer) onSettle?.(renderer, values);
  });

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

  // Declared after the renderer's effect, so the renderer exists by the time this one runs.
  useEffect(() => {
    const timer = window.setTimeout(settle, SETTLE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [finished]);

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
          onSettle={() => setFinished((count) => count + 1)}
          className="not-prose mt-6"
        />
      )}
      {panel}
    </>
  );
}
