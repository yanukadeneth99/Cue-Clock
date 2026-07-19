import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Read the installed React version instead of hardcoding it, so it can never
// drift out of sync with package.json.
const { version: reactVersion } = createRequire(import.meta.url)("react/package.json");

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Tell the linter our exact React version instead of "detect", since
  // auto-detect crashes with ESLint 10.
  {
    settings: {
      react: {
        version: reactVersion,
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
