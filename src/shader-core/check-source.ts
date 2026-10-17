// Checks a Shader's GLSL against its frontmatter (ADR 0009). The source is a string, so this
// runs without Astro. Errors give the author's file and line:
// - the source parses, and has no `#version`
// - every uniform is an Input or one of the Shader's Parameters, declared with its GLSL type
// - no samplers, uniform blocks or array uniforms
// - every Parameter has a uniform
import { parser } from "@shaderfrog/glsl-parser";
import type {
  BaseNode,
  Program,
  TypeQualifiers,
} from "@shaderfrog/glsl-parser/ast";
import { inputs, parameterTypes, type Parameter } from "./contract";

export interface Uniform {
  name: string;
  type: string;
  line: number;
}

/** `line` is the author's line in `shader.glsl`; it's absent for `index.mdx`, and when the parser gives none. */
export interface SourceError {
  file: "shader.glsl" | "index.mdx";
  line?: number;
  message: string;
}

export interface CheckedSource {
  uniforms: Uniform[];
  errors: SourceError[];
}

/**
 * Checks a Shader's GLSL source against its Parameters: it must parse, leave out `#version` (the
 * renderer supplies it, ADR 0010), and declare only Inputs and its own Parameters, each as a plain
 * uniform of the right type, and every Parameter must have a uniform (ADR 0009).
 *
 * The source is parsed without running the preprocessor, so line numbers match the author's file.
 * A uniform inside `#if … #endif` therefore counts as declared even when the condition is false.
 */
export function checkSource(
  source: string,
  parameters: readonly Pick<Parameter, "name" | "type">[],
): CheckedSource {
  let program: Program;
  try {
    program = parser.parse(source, {
      quiet: true,
      includeLocation: true,
      stage: "fragment",
    });
  } catch (error) {
    return { uniforms: [], errors: [syntaxError(error)] };
  }
  const { uniforms, errors } = declarations(program);

  const expectedTypes = new Map<string, string>(Object.entries(inputs));
  for (const parameter of parameters) {
    expectedTypes.set(parameter.name, parameterTypes[parameter.type].glsl);
  }

  for (const uniform of uniforms) {
    const expected = expectedTypes.get(uniform.name);
    // Every sampler type, such as `isampler2D` and `samplerCube`.
    if (/^[iu]?sampler/.test(uniform.type)) {
      errors.push({
        file: "shader.glsl",
        line: uniform.line,
        message: `Shaders are single-pass, so sampler uniform "${uniform.name}" has nothing to read`,
      });
    } else if (expected === undefined) {
      errors.push({
        file: "shader.glsl",
        line: uniform.line,
        message: `Uniform "${uniform.name}" is neither an Input nor a Parameter in the frontmatter`,
      });
    } else if (uniform.type !== expected) {
      errors.push({
        file: "shader.glsl",
        line: uniform.line,
        message: `Uniform "${uniform.name}" must be declared as ${expected}, not ${uniform.type}`,
      });
    }
  }

  const declared = new Set(uniforms.map((uniform) => uniform.name));
  for (const parameter of parameters) {
    if (!declared.has(parameter.name)) {
      errors.push({
        file: "index.mdx",
        message: `Parameter "${parameter.name}" has no uniform; declare \`uniform ${parameterTypes[parameter.type].glsl} ${parameter.name};\``,
      });
    }
  }

  return { uniforms, errors };
}

/**
 * The plain uniforms a parsed source declares, plus errors for what the site doesn't support:
 * `#version`, uniform blocks and array uniforms.
 */
function declarations(program: Program): CheckedSource {
  const uniforms: Uniform[] = [];
  const errors: SourceError[] = [];

  for (const statement of program.program) {
    // A `#version` inside a comment is whitespace to the parser, so it never reaches here.
    if (statement.type === "preprocessor") {
      if (/^#\s*version\b/.test(statement.line)) {
        errors.push({
          file: "shader.glsl",
          line: lineOf(statement),
          message: "Leave out #version; the renderer supplies it",
        });
      }
      continue;
    }
    if (statement.type !== "declaration_statement") continue;
    const { declaration } = statement;

    if (declaration.type === "interface_declarator") {
      if (isUniform(declaration.qualifiers)) {
        errors.push({
          file: "shader.glsl",
          line: lineOf(declaration.interface_type),
          message: `Uniform block "${declaration.interface_type.identifier}" isn't supported; declare each Input or Parameter as its own uniform`,
        });
      }
      continue;
    }
    if (declaration.type !== "declarator_list") continue;

    const { qualifiers, specifier } = declaration.specified_type;
    if (!isUniform(qualifiers)) continue;
    const type =
      "token" in specifier.specifier
        ? specifier.specifier.token
        : "identifier" in specifier.specifier
          ? specifier.specifier.identifier
          : "struct";

    for (const { identifier, quantifier } of declaration.declarations) {
      const line = lineOf(identifier);
      uniforms.push({ name: identifier.identifier, type, line });
      // `uniform float x[2];` and `uniform float[2] x;` both declare an array. The parser gives
      // `null` for no quantifier, whatever its types say.
      if ((quantifier as typeof quantifier | null) || specifier.quantifier) {
        errors.push({
          file: "shader.glsl",
          line,
          message: `Uniform "${identifier.identifier}" must not be an array`,
        });
      }
    }
  }

  return { uniforms, errors };
}

function isUniform(qualifiers: TypeQualifiers | null | undefined): boolean {
  return (
    qualifiers?.some((q) => "token" in q && q.token === "uniform") ?? false
  );
}

function lineOf(node: BaseNode): number {
  const line = node.location?.start.line;
  if (line === undefined) {
    throw new Error("The GLSL parser returned a node without a location");
  }
  return line;
}

function syntaxError(error: unknown): SourceError {
  const line = (error as { location?: { start?: { line?: number } } }).location
    ?.start?.line;
  const message =
    error instanceof Error ? (error.message.split("\n")[0] ?? "") : "";
  return { file: "shader.glsl", line, message: message || "GLSL syntax error" };
}
