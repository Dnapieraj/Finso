// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * Bazowa konfiguracja ESLint (flat config) współdzielona przez wszystkie
 * aplikacje i pakiety w monorepo. Apki dokładają swoje warstwy
 * (np. reguły dla Next.js) importując ten plik i rozszerzając tablicę.
 *
 * Reguły „type-checked” korzystają z kompilatora TypeScriptu, więc łapią
 * błędy, których sama składnia nie pokaże: zapomniany `await`
 * (no-floating-promises), async funkcję tam, gdzie oczekiwana jest
 * zwykła (no-misused-promises), `any` przeciekające z bibliotek.
 * `projectService` znajduje najbliższy tsconfig.json dla każdego pliku,
 * a lint każdego pakietu uruchamia turbo w katalogu tego pakietu.
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Pliki konfiguracyjne w JS nie należą do żadnego tsconfig.
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
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
