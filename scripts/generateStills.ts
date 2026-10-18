// Renders each Shader's Still into `<slug>/still.png`, which is committed so the build needs no
// browser (ADR 0005). Vite serves `stills-harness.html`, which bundles the site's own renderer,
// and headless Chromium draws one frame of each Shader at its `still.time`.
//
// Run with `node scripts/generateStills.ts` (`bun run stills`) after changing a Shader's source or
// `still.time`, and commit the result.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { parse } from "yaml";

// Must match `shadersDir` in src/shader-core/shaders.ts, which imports `astro:content` and so
// can't be imported here.
const shadersDir = "src/content/shaders";
const width = 1600;
const height = 900;

interface StillFrontmatter {
  still?: { time?: number; parameters?: Record<string, number> };
}

// Defined by stills-harness.html.
declare global {
  interface Window {
    renderStill(
      source: string,
      time: number,
      width: number,
      height: number,
    ): string;
  }
}

/** Each Shader's slug, source and Still settings, read straight from its directory. */
async function readShaders() {
  const entries = await readdir(shadersDir, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async ({ name: slug }) => {
        const dir = join(shadersDir, slug);
        const [mdx, source] = await Promise.all([
          readFile(join(dir, "index.mdx"), "utf8"),
          readFile(join(dir, "shader.glsl"), "utf8"),
        ]);
        // The frontmatter is everything between the file's first two `---` lines.
        const [before, frontmatter] = mdx.split(/^---$/m);
        if (before !== "" || frontmatter === undefined) {
          throw new Error(`${dir}/index.mdx: no frontmatter`);
        }
        // `astro build` validates the frontmatter afterwards; this reads only the Still's fields.
        const { still } = (parse(frontmatter) ?? {}) as StillFrontmatter;
        // The renderer doesn't set Parameters yet (#36), so a Still that sets one can't be honoured.
        if (Object.keys(still?.parameters ?? {}).length > 0) {
          throw new Error(
            `${dir}/index.mdx: still.parameters isn't supported until the renderer sets Parameters`,
          );
        }
        // Same default as `still.time` in shaderSchema.
        return { slug, dir, source, time: still?.time ?? 0 };
      }),
  );
}

const shaders = await readShaders();
const server = await createServer({
  configFile: false,
  logLevel: "error",
  server: { port: 0 },
});
await server.listen();
// The full Chromium build in new headless mode can render on the GPU; Playwright's default
// headless shell has no GPU support and falls back to SwiftShader on the CPU.
const browser = await chromium.launch({ channel: "chromium", headless: true });

try {
  // The renderer sizes its canvas by the device pixel ratio, so 1 makes it exactly width × height.
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const errors: string[] = [];
  // three.js reports compile and link failures on the console rather than throwing.
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error("Vite didn't report a local URL");
  // Resolves on `load`, after the harness's module script has run and defined `renderStill`.
  await page.goto(new URL("scripts/stills-harness.html", url).href);
  if (errors.length > 0) {
    throw new Error(`stills-harness.html failed to load\n${errors.join("\n")}`);
  }

  for (const { slug, dir, source, time } of shaders) {
    errors.length = 0;
    const dataUrl = await page.evaluate(
      ([source, time, width, height]) =>
        window.renderStill(source, time, width, height),
      [source, time, width, height] as const,
    );
    if (errors.length > 0) {
      throw new Error(
        `${dir}/shader.glsl: failed to render\n${errors.join("\n")}`,
      );
    }
    const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    await writeFile(join(dir, "still.png"), png);
    console.log(`Still: ${slug} at ${time}s`);
  }
} finally {
  await browser.close();
  await server.close();
}
