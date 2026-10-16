import { getCollection, type CollectionEntry } from "astro:content";
import { assertShadersPass } from "./check-shaders";

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

/**
 * Every Shader, Drafts included, with its source, after checking each source against its
 * Parameters (ADR 0009). Throws on any problem, so `astro build` fails. Drafts aren't filtered out
 * yet (RED-35); when they are, filter after calling this, so Drafts are still checked.
 */
export async function checkedShaders(): Promise<
  { shader: CollectionEntry<"shaders">; source: string }[]
> {
  const shaders = (await getCollection("shaders")).map((shader) => ({
    shader,
    source: shaderSource(shader.id),
  }));
  assertShadersPass(
    shaders.map(({ shader, source }) => ({
      slug: shader.id,
      source,
      parameters: shader.data.parameters,
    })),
  );
  return shaders;
}
