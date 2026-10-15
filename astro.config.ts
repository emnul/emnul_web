import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Unit tests cover pure logic; the adapter's Vite plugin would try to boot workerd inside Vitest.
const isVitest = process.env.VITEST !== undefined;

export default defineConfig({
  site: "https://emnul.dev",
  // Nothing persists across navigation (ADR 0001), so skip the adapter's default KV session binding.
  session: false,
  // Optimize images at build time (ADR 0005) instead of through the Cloudflare Images binding.
  adapter: isVitest ? undefined : cloudflare({ imageService: "compile" }),
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
