import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import type { Plugin } from "vite";

// Unit tests cover pure logic; the adapter's Vite plugin would try to boot workerd inside Vitest.
const isVitest = process.env.VITEST !== undefined;

// `.glsl` imports resolve to their source text, like `?raw`, so Shader source reads as a plain string.
function glslRaw(): Plugin {
  return {
    name: "glsl-raw",
    transform(code, id) {
      if (!id.endsWith(".glsl")) return null;
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

export default defineConfig({
  site: "https://emnul.dev",
  adapter: isVitest ? undefined : cloudflare(),
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss(), glslRaw()],
  },
});
