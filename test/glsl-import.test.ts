import { expect, test } from "vitest";
import source from "./fixtures/solid.glsl?raw";

test(".glsl?raw imports load the source as a string", () => {
  expect(typeof source).toBe("string");
  expect(source).toContain(
    "void mainImage(out vec4 fragColor, in vec2 fragCoord)",
  );
});
