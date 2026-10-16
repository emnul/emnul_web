import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One folder per Shader: `<slug>/index.mdx` holds the frontmatter and Write-up, `<slug>/shader.glsl` the source.
const shaders = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: "./src/content/shaders" }),
  // Strict, so a misspelled key fails `astro build`.
  schema: ({ image }) =>
    z.strictObject({
      title: z.string(),
      date: z.date(),
      description: z.string(),
      tags: z.array(z.string()),
      still: image(),
      featured: z.boolean(),
      // Shadertoy norms (ADR 0004); `attribution` credits the source of adapted work.
      license: z.string().default("CC BY-NC-SA 4.0"),
      attribution: z.string().optional(),
      // Caps the device pixel ratio for heavy Shaders (ADR 0003).
      maxPixelRatio: z.number().positive().optional(),
      draft: z.boolean(),
    }),
});

export const collections = { shaders };
