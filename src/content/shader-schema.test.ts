import { z } from "astro/zod";
import { describe, expect, test } from "vitest";
import { shaderSchema } from "./shader-schema";

// Stands in for Astro's `image()`, which only exists inside a collection's schema callback.
const schema = shaderSchema(z.string());

const valid = {
  title: "Drift",
  date: new Date("2026-10-15"),
  description: "Soft colour bands drifting across the screen.",
  tags: ["colour", "animation"],
  still: "./still.png",
  featured: true,
  draft: false,
};

describe("shaderSchema", () => {
  test("parses valid frontmatter", () => {
    const result = schema.safeParse(valid);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(valid);
  });

  test("defaults the license to CC BY-NC-SA 4.0", () => {
    expect(schema.parse(valid).license).toBe("CC BY-NC-SA 4.0");
  });

  test("keeps an overridden license and its attribution", () => {
    const shader = schema.parse({
      ...valid,
      license: "MIT",
      attribution: "Adapted from Inigo Quilez's 'Palettes'",
    });

    expect(shader.license).toBe("MIT");
    expect(shader.attribution).toBe("Adapted from Inigo Quilez's 'Palettes'");
  });

  test("accepts a maxPixelRatio cap", () => {
    expect(schema.parse({ ...valid, maxPixelRatio: 1.5 }).maxPixelRatio).toBe(
      1.5,
    );
  });

  test.each([0, -1])("rejects a maxPixelRatio of %d", (maxPixelRatio) => {
    expect(schema.safeParse({ ...valid, maxPixelRatio }).success).toBe(false);
  });

  test.each([
    "title",
    "date",
    "description",
    "tags",
    "still",
    "featured",
    "draft",
  ] as const)("rejects frontmatter missing %s", (key) => {
    const frontmatter = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== key),
    );
    const result = schema.safeParse(frontmatter);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ path: [key] }),
    );
  });

  test.each([
    ["title", 42],
    ["date", "2026-10-15"],
    ["tags", "colour"],
    ["featured", "yes"],
    ["draft", 1],
    ["license", null],
    ["maxPixelRatio", "2"],
  ])("rejects a %s of the wrong type", (key, value) => {
    const result = schema.safeParse({ ...valid, [key]: value });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code: "invalid_type", path: [key] }),
    );
  });

  test("rejects a misspelled key", () => {
    const { featured, ...rest } = valid;
    const result = schema.safeParse({ ...rest, featurd: featured });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(
      expect.objectContaining({ code: "unrecognized_keys", keys: ["featurd"] }),
    );
  });
});
