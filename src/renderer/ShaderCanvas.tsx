import { useEffect, useRef } from "react";

interface Props {
  /** The Shader's `shader.glsl`. */
  source: string;
  className?: string;
}

/**
 * A canvas running `source` live, sized by its container. three.js is imported once the
 * component mounts, so it's a separate chunk that only pages rendering a Shader load (ADR 0010).
 */
export default function ShaderCanvas({ source, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cleanup: (() => void) | undefined;
    let unmounted = false;

    void import("./renderer").then(({ createShaderRenderer }) => {
      if (unmounted) return;
      const renderer = createShaderRenderer(canvas, source);
      const observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        renderer.resize(entry.contentRect.width, entry.contentRect.height);
      });
      observer.observe(canvas);
      renderer.start();
      cleanup = () => {
        observer.disconnect();
        renderer.dispose();
      };
    });

    return () => {
      unmounted = true;
      cleanup?.();
    };
  }, [source]);

  return <canvas ref={canvasRef} className={className} />;
}
