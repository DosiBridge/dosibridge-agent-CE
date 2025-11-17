import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Auto-generated files:
    "types/validator.ts",
  ]),
  {
    rules: {
      // Disable Tailwind class name warnings - these are false positives
      // bg-gradient-to-* and break-words are valid Tailwind classes
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
