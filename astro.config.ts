import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Unit tests cover pure logic; the adapter's Vite plugin would try to boot workerd inside Vitest.
const isVitest = process.env.VITEST !== undefined;
// `astro check` only gains the adapter's App.Locals runtime type, which nothing reads yet; drop this once code uses Astro.locals.runtime.
const isAstroCheck = process.env.ASTRO_CHECK !== undefined;

export default defineConfig({
  site: "https://emnul.dev",
  // Nothing persists across navigation (ADR 0001), so skip the adapter's default KV session binding.
  session: false,
  // Optimize images at build time (ADR 0005) instead of through the Cloudflare Images binding.
  adapter:
    isVitest || isAstroCheck
      ? undefined
      : cloudflare({ imageService: "compile" }),
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
