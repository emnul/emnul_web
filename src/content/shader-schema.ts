import { z } from "astro/zod";

/**
 * Frontmatter of a Shader's `index.mdx`. `still` is the schema for the Still, which is Astro's
 * `image()` in the collection and a stand-in in tests.
 */
export function shaderSchema<Still extends z.ZodType>(still: Still) {
  return z.strictObject({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    tags: z.array(z.string()),
    still,
    featured: z.boolean(),
    // Shadertoy norms (ADR 0004); `attribution` credits the source of adapted work.
    license: z.string().default("CC BY-NC-SA 4.0"),
    attribution: z.string().optional(),
    // Caps the device pixel ratio for heavy Shaders (ADR 0003).
    maxPixelRatio: z.number().positive().optional(),
    draft: z.boolean(),
  });
}
