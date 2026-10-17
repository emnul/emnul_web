import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { shadersDir, shaderSchema } from "./shader-core/shaders";

// The loader stays here: it's Node-only, and pages import ./shader-core/shaders into workerd.
const shaders = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: `./${shadersDir}` }),
  schema: shaderSchema,
});

export const collections = { shaders };
