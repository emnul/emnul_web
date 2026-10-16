import type { CollectionEntry } from "astro:content";

const sources = import.meta.glob<string>("/src/content/shaders/*/shader.glsl", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The GLSL source of the Shader with this slug, as raw text, so the renderer and the source
 * panel share one copy.
 */
export function shaderSource(slug: CollectionEntry<"shaders">["id"]): string {
  const source = sources[`/src/content/shaders/${slug}/shader.glsl`];
  if (source === undefined) {
    throw new Error(
      `Shader "${slug}" has no shader.glsl next to its index.mdx`,
    );
  }
  return source;
}
