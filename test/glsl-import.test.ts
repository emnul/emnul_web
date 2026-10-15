import { expect, test } from "vitest";
import source from "./fixtures/solid.glsl";

test(".glsl files import as raw source strings", () => {
  expect(typeof source).toBe("string");
  expect(source).toContain("void mainImage(out vec4 fragColor, in vec2 fragCoord)");
});
