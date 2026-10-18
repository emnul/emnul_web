// The Shaders collection, and the only module the rest of the site imports from the Shader core.
// It checks in two phases:
// 1. `shaderSchema`, run by Astro's content loader on each entry, checks the frontmatter: strict
//    keys and types, plus the contract checks in `contract.ts`. It sees only the frontmatter.
// 2. `checkedShaders`, run when a page builds, pairs each `index.mdx` with its `shader.glsl`. It
//    flags a missing file on either side, checks each source with `check-source.ts`, and throws
//    one error listing every problem.
import {
  getCollection,
  type CollectionEntry,
  type SchemaContext,
} from "astro:content";
import { z } from "astro/zod";
import { checkSource } from "./check-source";
import { checkStillValues, parametersSchema, type Parameter } from "./contract";

/**
 * One directory per Shader: `<slug>/index.mdx` holds the frontmatter and Write-up, `<slug>/shader.glsl`
 * the source. The collection's loader in `content.config.ts` reads this, since the loader is
 * Node-only and pages import this module into the workerd prerender (ADR 0006).
 */
export const shadersDir = "src/content/shaders";

/** A Shader's frontmatter. Strict, so a misspelled key fails `astro build`. */
export const shaderSchema = ({ image }: SchemaContext) =>
  z
    .strictObject({
      title: z.string(),
      date: z.date(),
      description: z.string(),
      // The Still is captured at `time` seconds and these Parameter values; the rest take their defaults.
      still: z.strictObject({
        image: image(),
        time: z.number().nonnegative().default(0),
        parameters: z.record(z.string(), z.number()).default({}),
      }),
      parameters: parametersSchema,
      featured: z.boolean(),
      // CC BY-NC-SA by default (ADR 0004); `attribution` credits the source of adapted work.
      license: z.string().default("CC BY-NC-SA 4.0"),
      attribution: z.string().optional(),
      // Caps the device pixel ratio for heavy Shaders (ADR 0010).
      maxPixelRatio: z.number().positive().optional(),
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

// `import.meta.glob` takes only a literal, so this repeats `shadersDir`.
const sources = import.meta.glob<string>("/src/content/shaders/*/shader.glsl", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * Every Shader with its GLSL source as raw text, after checking each source
 * against its Parameters (ADR 0009).
 */
export async function checkedShaders(): Promise<
  { shader: CollectionEntry<"shaders">; source: string }[]
> {
  return checkShaderSources(await getCollection("shaders"), sources);
}

/**
 * Pairs each Shader with its source in `sourcesByPath`, keyed as `import.meta.glob` keys each
 * `shader.glsl`, and checks it. Throws one error listing every problem, each prefixed with the
 * file it's in, so a single `astro build` shows them all.
 */
export function checkShaderSources<
  Shader extends { id: string; data: { parameters: readonly Parameter[] } },
>(
  entries: readonly Shader[],
  sourcesByPath: Readonly<Record<string, string>>,
): { shader: Shader; source: string }[] {
  const shaders: { shader: Shader; source: string }[] = [];
  const problems: string[] = [];

  // The site always has a Shader, so none means the loader is looking in the wrong place.
  if (entries.length === 0) {
    throw new Error(`No Shaders found under ${shadersDir}/`);
  }

  for (const shader of entries) {
    const source = sourcesByPath[`/${shadersDir}/${shader.id}/shader.glsl`];
    if (source === undefined) {
      problems.push(
        `${shadersDir}/${shader.id}/shader.glsl: missing; each Shader directory needs one`,
      );
      continue;
    }
    shaders.push({ shader, source });
    const { errors } = checkSource(source, shader.data.parameters);
    for (const { file, line, message } of errors) {
      const at = line === undefined ? file : `${file}:${line}`;
      problems.push(`${shadersDir}/${shader.id}/${at}: ${message}`);
    }
  }

  const slugs = new Set(shaders.map(({ shader }) => shader.id));
  for (const path of Object.keys(sourcesByPath)) {
    const slug = path.split("/").at(-2);
    if (slug !== undefined && !slugs.has(slug)) {
      problems.push(
        `${shadersDir}/${slug}/index.mdx: missing; shader.glsl has no Shader`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Shader check failed:\n${problems.join("\n")}`);
  }
  return shaders;
}
