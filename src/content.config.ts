import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { shaderSchema } from "./content/shader-schema";

// One folder per Shader: `<slug>/index.mdx` holds the frontmatter and Write-up, `<slug>/shader.glsl` the source.
const shaders = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: "./src/content/shaders" }),
  schema: ({ image }) => shaderSchema(image()),
});

export const collections = { shaders };
