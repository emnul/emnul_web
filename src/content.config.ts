import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { checkStillValues, parametersSchema } from "./shader-core/contract";

// One folder per Shader: `<slug>/index.mdx` holds the frontmatter and Write-up, `<slug>/shader.glsl` the source.
const shaders = defineCollection({
  loader: glob({ pattern: "*/index.mdx", base: "./src/content/shaders" }),
  // Strict, so a misspelled key fails `astro build`.
  schema: ({ image }) =>
    z
      .strictObject({
        title: z.string(),
        date: z.date(),
        description: z.string(),
        tags: z.array(z.string()),
        // The Still is captured at `time` seconds and these Parameter values; the rest take their defaults.
        still: z.strictObject({
          image: image(),
          time: z.number().nonnegative().default(1),
          parameters: z.record(z.string(), z.number()).default({}),
        }),
        parameters: parametersSchema,
        featured: z.boolean(),
        // CC BY-NC-SA by default (ADR 0004); `attribution` credits the source of adapted work.
        license: z.string().default("CC BY-NC-SA 4.0"),
        attribution: z.string().optional(),
        // Caps the device pixel ratio for heavy Shaders (ADR 0010).
        maxPixelRatio: z.number().positive().optional(),
        draft: z.boolean(),
      })
      .superRefine((shader, ctx) => {
        for (const issue of checkStillValues(
          shader.parameters,
          shader.still.parameters,
        )) {
          ctx.addIssue({
            code: "custom",
            path: ["still", "parameters", ...issue.path],
            message: issue.message,
          });
        }
      }),
});

export const collections = { shaders };
