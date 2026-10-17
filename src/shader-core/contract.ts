import { z } from "astro/zod";

/** The Inputs and the GLSL type each must be declared with. */
export const inputs = { u_resolution: "vec2", u_time: "float" } as const;

// A GLSL identifier that isn't an Input; the GLSL itself is checked against these at build (ADR 0009).
const parameterName = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "must be a GLSL identifier")
  .refine((name) => !Object.hasOwn(inputs, name), "must not be an Input name");

/** Ties a Parameter type's `inRange` to the fields its schema produces. */
function parameterType<Schema extends z.ZodType<{ type: string }>>(row: {
  /** The frontmatter fields, keyed by the literal `type`. */
  schema: Schema;
  /** The type its uniform must be declared with. */
  glsl: string;
  /** Whether the Shader can receive this value, such as one a Still sets. */
  inRange: (parameter: z.infer<Schema>, value: number) => boolean;
}) {
  return row;
}

/** One row per Parameter type (ADR 0011); a new type is a new row here. */
export const parameterTypes = {
  number: parameterType({
    schema: z
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
    glsl: "float",
    inRange: (p, value) => value >= p.min && value <= p.max,
  }),
  choice: parameterType({
    schema: z
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
    glsl: "int",
    inRange: (p, value) =>
      Number.isInteger(value) && value >= 0 && value < p.options.length,
  }),
};

type ParameterSchema =
  (typeof parameterTypes)[keyof typeof parameterTypes]["schema"];

// Built from the rows, so a new row is a new member without another edit.
const parameter = z.discriminatedUnion(
  "type",
  Object.values(parameterTypes).map((row) => row.schema) as [
    ParameterSchema,
    ...ParameterSchema[],
  ],
);

export type Parameter = z.infer<typeof parameter>;

/** A Shader's Parameters, as its frontmatter lists them. */
export const parametersSchema = z
  .array(parameter)
  .default([])
  .superRefine((parameters, ctx) => {
    const names = parameters.map((p) => p.name);
    names.forEach((name, index) => {
      if (names.indexOf(name) !== index) {
        ctx.addIssue({
          code: "custom",
          path: [index, "name"],
          message: `Parameter "${name}" is declared twice`,
        });
      }
    });
  });

export interface ParameterIssue {
  path: string[];
  message: string;
}

/**
 * Problems with values set for these Parameters, such as a Still's: each must name one of them
 * and be a value it can take. Paths are the value's key.
 */
export function checkStillValues(
  parameters: readonly Parameter[],
  values: Readonly<Record<string, number>>,
): ParameterIssue[] {
  return Object.entries(values).flatMap(([name, value]) => {
    const declared = parameters.find((p) => p.name === name);
    if (!declared) {
      return [
        {
          path: [name],
          message: `"${name}" is not a Parameter of this Shader`,
        },
      ];
    }
    return inRange(declared, value)
      ? []
      : [
          {
            path: [name],
            message: `${value} is outside Parameter "${name}"'s range`,
          },
        ];
  });
}

function inRange(parameter: Parameter, value: number): boolean {
  // The row matches the Parameter by `type`, which TypeScript can't correlate through the lookup.
  const row = parameterTypes[parameter.type] as {
    inRange: (parameter: Parameter, value: number) => boolean;
  };
  return row.inRange(parameter, value);
}
