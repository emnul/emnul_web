import { parser } from "@shaderfrog/glsl-parser";
import type {
  BaseNode,
  Program,
  TypeQualifiers,
} from "@shaderfrog/glsl-parser/ast";

/** The Inputs and the GLSL type each must be declared with. */
export const inputs = { u_resolution: "vec2", u_time: "float" } as const;

/** The GLSL type each Parameter type is declared with. */
export const parameterGlslTypes = { number: "float", choice: "int" } as const;

export interface ParameterDeclaration {
  name: string;
  type: keyof typeof parameterGlslTypes;
}

export interface Uniform {
  name: string;
  type: string;
  line: number;
}

/** `line` is the author's line in `shader.glsl`; it's absent when the problem is in the frontmatter. */
export interface SourceError {
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
  parameters: readonly ParameterDeclaration[],
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
    expectedTypes.set(parameter.name, parameterGlslTypes[parameter.type]);
  }

  for (const uniform of uniforms) {
    const expected = expectedTypes.get(uniform.name);
    // Every sampler type, such as `isampler2D` and `samplerCube`.
    if (/^[iu]?sampler/.test(uniform.type)) {
      errors.push({
        line: uniform.line,
        message: `Shaders are single-pass, so sampler uniform "${uniform.name}" has nothing to read`,
      });
    } else if (expected === undefined) {
      errors.push({
        line: uniform.line,
        message: `Uniform "${uniform.name}" is neither an Input nor a Parameter in the frontmatter`,
      });
    } else if (uniform.type !== expected) {
      errors.push({
        line: uniform.line,
        message: `Uniform "${uniform.name}" must be declared as ${expected}, not ${uniform.type}`,
      });
    }
  }

  const declared = new Set(uniforms.map((uniform) => uniform.name));
  for (const parameter of parameters) {
    if (!declared.has(parameter.name)) {
      errors.push({
        message: `Parameter "${parameter.name}" has no uniform; declare \`uniform ${parameterGlslTypes[parameter.type]} ${parameter.name};\``,
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
  return { line, message: message || "GLSL syntax error" };
}
