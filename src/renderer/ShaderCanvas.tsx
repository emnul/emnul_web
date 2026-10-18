import { StrictMode, useEffect, useRef } from "react";
import { createShaderRenderer } from "./renderer";

interface Props {
  /** The Shader's `shader.glsl`. */
  source: string;
  className?: string;
}

/**
 * A canvas running `source` live, sized by its container. three.js ships in this island's
 * chunk, so only pages rendering a Shader load it (ADR 0010).
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
function Canvas({ source, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createShaderRenderer(canvas, source);
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      renderer.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
    renderer.start();

    return () => {
      observer.disconnect();
      renderer.dispose();
    };
  }, [source]);

  return <canvas ref={canvasRef} className={className} />;
}
