import { checkSource } from "../shader-core/check-source";
import type { Parameter } from "../shader-core/contract";

export interface ShaderToCheck {
  slug: string;
  source: string;
  parameters: readonly Pick<Parameter, "name" | "type">[];
}

/**
 * Throws one error listing every problem across these Shaders, each prefixed with the file it's in,
 * so a single `astro build` shows them all (ADR 0009).
 */
export function assertShadersPass(shaders: readonly ShaderToCheck[]): void {
  const problems = shaders.flatMap(({ slug, source, parameters }) =>
    checkSource(source, parameters).errors.map(
      ({ line, message }) =>
        `src/content/shaders/${slug}/${line === undefined ? "index.mdx" : `shader.glsl:${line}`}: ${message}`,
    ),
  );
  if (problems.length > 0) {
    throw new Error(`Shader check failed:\n${problems.join("\n")}`);
  }
}
