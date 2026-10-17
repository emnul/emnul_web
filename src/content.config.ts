import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { folder, shaderSchema } from "./content/shaders";

// The loader stays here: it's Node-only, and pages import ./content/shaders into workerd.
const shaders = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: `./${folder}` }),
  schema: shaderSchema,
});

export const collections = { shaders };
