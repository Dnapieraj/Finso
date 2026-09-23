// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Bazowa konfiguracja ESLint (flat config) współdzielona przez wszystkie
 * aplikacje i pakiety w monorepo. Apki dokładają swoje warstwy
 * (np. reguły dla Next.js) importując ten plik i rozszerzając tablicę.
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/generated/**",
    ],
  },
  eslintConfigPrettier,
);

export default baseConfig;
