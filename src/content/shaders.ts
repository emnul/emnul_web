import {
  getCollection,
  type CollectionEntry,
  type SchemaContext,
} from "astro:content";
import { z } from "astro/zod";
import { checkSource } from "../shader-core/check-source";
import { checkStillValues, parametersSchema } from "../shader-core/contract";

/**
 * One folder per Shader: `<slug>/index.mdx` holds the frontmatter and Write-up, `<slug>/shader.glsl`
 * the source. The collection's loader in `content.config.ts` reads this, since the loader is
 * Node-only and pages import this module into the workerd prerender (ADR 0006).
 */
export const folder = "src/content/shaders";

/** A Shader's frontmatter. Strict, so a misspelled key fails `astro build`. */
export const shaderSchema = ({ image }: SchemaContext) =>
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
    });

// `import.meta.glob` takes only a literal, so this repeats `folder`.
const sources = import.meta.glob<string>("/src/content/shaders/*/shader.glsl", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Every Shader, Drafts included, with its GLSL source as raw text, after checking each source
 * against its Parameters (ADR 0009). Throws one error listing every problem, each prefixed with
 * the file it's in, so a single `astro build` shows them all. Drafts aren't filtered out yet
 * (RED-35); when they are, filter after the check, so Drafts are still checked.
 */
export async function checkedShaders(): Promise<
  { shader: CollectionEntry<"shaders">; source: string }[]
> {
  const shaders: { shader: CollectionEntry<"shaders">; source: string }[] = [];
  const problems: string[] = [];

  const entries = await getCollection("shaders");
  // The site always has a Shader, so none means the loader is looking in the wrong place.
  if (entries.length === 0) {
    throw new Error(`No Shaders found under ${folder}/`);
  }

  for (const shader of entries) {
    const source = sources[`/${folder}/${shader.id}/shader.glsl`];
    if (source === undefined) {
      problems.push(
        `${folder}/${shader.id}/shader.glsl: missing; each Shader folder needs one`,
      );
      continue;
    }
    shaders.push({ shader, source });
    for (const { line, message } of checkSource(source, shader.data.parameters)
      .errors) {
      problems.push(
        `${folder}/${shader.id}/${line === undefined ? "index.mdx" : `shader.glsl:${line}`}: ${message}`,
      );
    }
  }

  const slugs = new Set(shaders.map(({ shader }) => shader.id));
  for (const path of Object.keys(sources)) {
    const slug = path.split("/").at(-2);
    if (slug !== undefined && !slugs.has(slug)) {
      problems.push(
        `${folder}/${slug}/index.mdx: missing; shader.glsl has no Shader`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Shader check failed:\n${problems.join("\n")}`);
  }
  return shaders;
}
