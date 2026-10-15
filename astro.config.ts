import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Unit tests cover pure logic; the adapter's Vite plugin would try to boot workerd inside Vitest.
const isVitest = process.env.VITEST !== undefined;

export default defineConfig({
  site: "https://emnul.dev",
  adapter: isVitest ? undefined : cloudflare(),
  integrations: [react(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
