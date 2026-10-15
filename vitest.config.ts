/// <reference types="vitest/config" />
import { playwright } from "@vitest/browser-playwright";
import { getViteConfig } from "astro/config";

const allTests = ["src/**/*.test.ts", "test/**/*.test.ts"];
const browserTests = ["src/**/*.browser.test.ts", "test/**/*.browser.test.ts"];

// Both projects extend this config, so they share the site's Vite pipeline.
// `bun run test` selects only `unit`, so it never needs Playwright browsers (Workers Builds runs it).
export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: allTests, exclude: browserTests },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: browserTests,
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "webkit" }, { browser: "chromium" }],
          },
        },
      },
    ],
  },
});
