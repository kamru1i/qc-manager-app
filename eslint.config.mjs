import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    "scratch/**",
    "src/js/**",
    "src-tauri/**",
    "scripts/**",
    // Capacitor build output — copied web bundles + generated native-bridge,
    // not source code (was producing thousands of false lint findings).
    "android/**",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "warn", // Changed from "off" to "warn" for better type safety
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": "warn"
    }
  }
]);

export default eslintConfig;
