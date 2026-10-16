import { parser } from "@shaderfrog/glsl-parser";
import type { DeclarationStatementNode } from "@shaderfrog/glsl-parser/ast";

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
 * renderer supplies it, ADR 0010), and declare only Inputs and its own Parameters, each with the
 * right type, and every Parameter must have a uniform (ADR 0009).
 *
 * The source is parsed without running the preprocessor, so line numbers match the author's file.
 * A uniform inside `#if … #endif` therefore counts as declared even when the condition is false.
 */
export function checkSource(
  source: string,
  parameters: readonly ParameterDeclaration[],
): CheckedSource {
  const errors: SourceError[] = [];

  source.split("\n").forEach((line, index) => {
    if (/^\s*#\s*version\b/.test(line)) {
      errors.push({
        line: index + 1,
        message: "Leave out #version; the renderer supplies it",
      });
    }
  });

  let uniforms: Uniform[];
  try {
    uniforms = declaredUniforms(source);
  } catch (error) {
    return { uniforms: [], errors: [...errors, syntaxError(error)] };
  }

  const expectedTypes = new Map<string, string>(Object.entries(inputs));
  for (const parameter of parameters) {
    expectedTypes.set(parameter.name, parameterGlslTypes[parameter.type]);
  }

  for (const uniform of uniforms) {
    const expected = expectedTypes.get(uniform.name);
    if (uniform.type.startsWith("sampler")) {
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

function declaredUniforms(source: string): Uniform[] {
  const program = parser.parse(source, {
    quiet: true,
    includeLocation: true,
    stage: "fragment",
  });
  const uniforms: Uniform[] = [];
  for (const statement of program.program) {
    if (statement.type !== "declaration_statement") continue;
    const { declaration } = statement as DeclarationStatementNode;
    if (declaration.type !== "declarator_list") continue;
    const { qualifiers, specifier } = declaration.specified_type;
    if (!qualifiers?.some((q) => "token" in q && q.token === "uniform")) {
      continue;
    }
    const type =
      "token" in specifier.specifier
        ? specifier.specifier.token
        : "identifier" in specifier.specifier
          ? specifier.specifier.identifier
          : "struct";
    for (const { identifier } of declaration.declarations) {
      uniforms.push({
        name: identifier.identifier,
        type,
        line: identifier.location?.start.line ?? 0,
      });
    }
  }
  return uniforms;
}

function syntaxError(error: unknown): SourceError {
  const line = (error as { location?: { start?: { line?: number } } }).location
    ?.start?.line;
  const message =
    error instanceof Error ? (error.message.split("\n")[0] ?? "") : "";
  return { line, message: message || "GLSL syntax error" };
}
