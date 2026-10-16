import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { inputs } from "./shader-core/check-source";

// A GLSL identifier that isn't an Input; the GLSL itself is checked against these at build (ADR 0009).
const parameterName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "must be a GLSL identifier")
  .refine((name) => !(name in inputs), "must not be an Input name");

// One entry per Parameter type (ADR 0011); a new type is a new member of the union.
const parameter = z.discriminatedUnion("type", [
  z
    .strictObject({
      type: z.literal("number"),
      name: parameterName,
      label: z.string(),
      default: z.number(),
      min: z.number(),
      max: z.number(),
      step: z.number().positive(),
    })
    .refine((p) => p.min < p.max, "min must be below max")
    .refine(
      (p) => p.default >= p.min && p.default <= p.max,
      "default must lie within min–max",
    ),
  z
    .strictObject({
      type: z.literal("choice"),
      name: parameterName,
      label: z.string(),
      options: z.array(z.string()).min(2),
      // The option's index, which is the value the Shader receives.
      default: z.int().nonnegative(),
    })
    .refine(
      (p) => p.default < p.options.length,
      "default must be an option index",
    ),
]);

type Parameter = z.infer<typeof parameter>;

function inRange(parameter: Parameter, value: number): boolean {
  return parameter.type === "number"
    ? value >= parameter.min && value <= parameter.max
    : Number.isInteger(value) && value >= 0 && value < parameter.options.length;
}

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
        parameters: z.array(parameter).default([]),
        featured: z.boolean(),
        // CC BY-NC-SA by default (ADR 0004); `attribution` credits the source of adapted work.
        license: z.string().default("CC BY-NC-SA 4.0"),
        attribution: z.string().optional(),
        // Caps the device pixel ratio for heavy Shaders (ADR 0010).
        maxPixelRatio: z.number().positive().optional(),
        draft: z.boolean(),
      })
      .superRefine((shader, ctx) => {
        const names = shader.parameters.map((p) => p.name);
        names.forEach((name, index) => {
          if (names.indexOf(name) !== index) {
            ctx.addIssue({
              code: "custom",
              path: ["parameters", index, "name"],
              message: `Parameter "${name}" is declared twice`,
            });
          }
        });
        for (const [name, value] of Object.entries(shader.still.parameters)) {
          const declared = shader.parameters.find((p) => p.name === name);
          if (!declared || !inRange(declared, value)) {
            ctx.addIssue({
              code: "custom",
              path: ["still", "parameters", name],
              message: declared
                ? `${value} is outside Parameter "${name}"'s range`
                : `"${name}" is not a Parameter of this Shader`,
            });
          }
        }
      }),
});

export const collections = { shaders };
