import { getCollection, type CollectionEntry } from "astro:content";
import { checkSource } from "../shader-core/check-source";

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
 * Parameters (ADR 0009). Throws on any problem, so `astro build` fails; filter Drafts out after
 * calling this, never before.
 */
export async function checkedShaders(): Promise<
  { shader: CollectionEntry<"shaders">; source: string }[]
> {
  const shaders = (await getCollection("shaders")).map((shader) => ({
    shader,
    source: shaderSource(shader.id),
  }));

  const problems = shaders.flatMap(({ shader, source }) =>
    checkSource(source, shader.data.parameters).errors.map(
      ({ line, message }) =>
        `src/content/shaders/${shader.id}/${line === undefined ? "index.mdx" : `shader.glsl:${line}`}: ${message}`,
    ),
  );
  if (problems.length > 0) {
    throw new Error(`Shader check failed:\n${problems.join("\n")}`);
  }
  return shaders;
}
