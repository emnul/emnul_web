import { expect, test } from "vitest";
import { checkStillValues, parametersSchema } from "./contract";

const speed = {
  type: "number",
  name: "speed",
  label: "Speed",
  default: 1,
  min: 0,
  max: 2,
  step: 0.1,
};

const shape = {
  type: "choice",
  name: "shape",
  label: "Shape",
  options: ["circle", "square"],
  default: 1,
};

/** The message and path of each problem the schema reports. */
function issues(parameters: unknown) {
  const result = parametersSchema.safeParse(parameters);
  return result.success
    ? []
    : result.error.issues.map(({ path, message }) => ({ path, message }));
}

test("a Parameter name may be used only once", () => {
  expect(issues([speed, { ...speed, label: "Speed again" }])).toEqual([
    { path: [1, "name"], message: 'Parameter "speed" is declared twice' },
  ]);
});

test("a Parameter name must be a GLSL identifier and not an Input", () => {
  expect(
    issues([
      { ...speed, name: "2fast" },
      { ...speed, name: "u_time" },
    ]),
  ).toEqual([
    { path: [0, "name"], message: "must be a GLSL identifier" },
    { path: [1, "name"], message: "must not be an Input name" },
  ]);
});

test("a Parameter may share a name with a built-in object property", () => {
  expect(
    issues([
      { ...speed, name: "toString" },
      { ...speed, name: "constructor" },
    ]),
  ).toEqual([]);
});

test("a Still may set only declared Parameters, each to a value it can take", () => {
  const parameters = parametersSchema.parse([speed, shape]);

  expect(
    checkStillValues(parameters, {
      speed: 3,
      shape: 0.5,
      zoom: 1,
    }),
  ).toEqual([
    { path: ["speed"], message: '3 is outside Parameter "speed"\'s range' },
    { path: ["shape"], message: '0.5 is outside Parameter "shape"\'s range' },
    { path: ["zoom"], message: '"zoom" is not a Parameter of this Shader' },
  ]);
  expect(checkStillValues(parameters, { speed: 2, shape: 1 })).toEqual([]);
});
