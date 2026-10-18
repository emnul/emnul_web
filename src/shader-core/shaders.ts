// The Shaders collection, and the only module the rest of the site imports from the Shader core.
// It checks in two phases:
// 1. `shaderSchema`, run by Astro's content loader on each entry, checks the frontmatter: strict
//    keys and types, plus the contract checks in `contract.ts`. It sees only the frontmatter.
// 2. `checkedShaders`, run when a page builds, pairs each `index.mdx` with its `shader.glsl` and
//    the `still.png` that `scripts/generateStills.ts` rendered. It flags a missing file, checks
//    each source with `check-source.ts`, and throws one error listing every problem.
import type { ImageMetadata } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
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
export const shaderSchema = z
  .strictObject({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    // The Still is rendered at `time` seconds and these Parameter values; the rest take their
    // defaults. The live Shader starts at `time` too, so its first frame matches the Still.
    // scripts/generateStills.ts reads these without this schema, so it repeats the defaults.
    still: z
      .strictObject({
        time: z.number().nonnegative().default(0),
        parameters: z.record(z.string(), z.number()).default({}),
      })
      .default({ time: 0, parameters: {} }),
    parameters: parametersSchema,
    featured: z.boolean(),
    // CC BY-NC-SA by default (ADR 0004); `attribution` credits the source of adapted work.
    license: z.string().default("CC BY-NC-SA 4.0"),
    attribution: z.string().optional(),
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

// `import.meta.glob` takes only a literal, so these repeat `shadersDir`.
const sources = import.meta.glob<string>("/src/content/shaders/*/shader.glsl", {
  query: "?raw",
  import: "default",
  eager: true,
});
const stills = import.meta.glob<ImageMetadata>(
  "/src/content/shaders/*/still.png",
  { import: "default", eager: true },
);

/** A Shader paired with its GLSL source as raw text and its Still, once both have been checked. */
export interface CheckedShader<Shader, Still> {
  shader: Shader;
  source: string;
  still: Still;
}

/**
 * Every Shader with its GLSL source as raw text and its Still, after checking each source
 * against its Parameters (ADR 0009).
 */
export async function checkedShaders(): Promise<
  CheckedShader<CollectionEntry<"shaders">, ImageMetadata>[]
> {
  return checkShaderSources(await getCollection("shaders"), sources, stills);
}

/**
 * Pairs each Shader with its source in `sourcesByPath` and its Still in `stillsByPath`, keyed as
 * `import.meta.glob` keys each `shader.glsl` and `still.png`, and checks it. Throws one error
 * listing every problem, each prefixed with the file it's in, so a single `astro build` shows
 * them all.
 */
export function checkShaderSources<
  Shader extends { id: string; data: { parameters: readonly Parameter[] } },
  Still,
>(
  entries: readonly Shader[],
  sourcesByPath: Readonly<Record<string, string>>,
  stillsByPath: Readonly<Record<string, Still>>,
): CheckedShader<Shader, Still>[] {
  const shaders: CheckedShader<Shader, Still>[] = [];
  const problems: string[] = [];

  // The site always has a Shader, so none means the loader is looking in the wrong place.
  if (entries.length === 0) {
    throw new Error(`No Shaders found under ${shadersDir}/`);
  }

  for (const shader of entries) {
    const source = sourcesByPath[`/${shadersDir}/${shader.id}/shader.glsl`];
    const still = stillsByPath[`/${shadersDir}/${shader.id}/still.png`];
    if (still === undefined) {
      problems.push(
        `${shadersDir}/${shader.id}/still.png: missing; run \`bun run stills\``,
      );
    }
    if (source === undefined) {
      problems.push(
        `${shadersDir}/${shader.id}/shader.glsl: missing; each Shader directory needs one`,
      );
      continue;
    }
    if (still !== undefined) shaders.push({ shader, source, still });
    const { errors } = checkSource(source, shader.data.parameters);
    for (const { file, line, message } of errors) {
      const at = line === undefined ? file : `${file}:${line}`;
      problems.push(`${shadersDir}/${shader.id}/${at}: ${message}`);
    }
  }

  const slugs = new Set(entries.map((shader) => shader.id));
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
