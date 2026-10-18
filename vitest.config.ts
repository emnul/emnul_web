/// <reference types="vitest/config" />
import { playwright } from "@vitest/browser-playwright";
import { getViteConfig } from "astro/config";

// `!(*.browser)` keeps browser tests out of the unit glob itself, so no exclude is needed.
const unitTests = [
  "src/**/!(*.browser).test.ts",
  "test/**/!(*.browser).test.ts",
];
// `.tsx` for tests that render React components into the page.
const browserTests = [
  "src/**/*.browser.test.{ts,tsx}",
  "test/**/*.browser.test.{ts,tsx}",
];

// Both projects extend this config, so they share the site's Vite pipeline.
// `bun run test` selects only `unit`, so it never needs Playwright browsers (Workers Builds runs it).
export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: unitTests },
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
