import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", ".astro/", ".wrangler/", "node_modules/", "tmp/"]),
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ["src/**"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["*.config.ts", "test/**"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "BinaryExpression[operator='in'][left.type!='Literal']",
          message:
            "Use Object.hasOwn(object, key): `in` also matches inherited keys such as toString.",
        },
      ],
    },
  },
);
