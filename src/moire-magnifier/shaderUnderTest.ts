// The real Moiré magnifier for its browser tests, which the spec requires to render shader.glsl
// itself. Its Parameters start at their defaults in index.mdx, so editing the Shader's frontmatter
// never means editing a test.
import { parse } from "yaml";
import mdx from "../content/shaders/moire-magnifier/index.mdx?raw";
import source from "../content/shaders/moire-magnifier/shader.glsl?raw";
import { createShaderRenderer, withDefaults } from "../renderer/renderer";

interface Frontmatter {
  parameters: { name: string; default: number }[];
}

/** A renderer drawing the Moiré magnifier with each Parameter at its default. */
export function createMoireRenderer() {
  // The frontmatter is everything between the file's first two `---` lines, as in
  // scripts/generateStills.ts; `astro build` validates it.
  const [, frontmatter = ""] = mdx.split(/^---$/m);
  const { parameters } = parse(frontmatter) as Frontmatter;
  // Never started, so every render is at `u_time` 0.
  return createShaderRenderer(document.createElement("canvas"), {
    source,
    startTime: 0,
    values: withDefaults(parameters),
  });
}
