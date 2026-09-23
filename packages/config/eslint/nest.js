// @ts-check
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.js";

/**
 * Konfiguracja ESLint dla apps/api (NestJS).
 * Dokłada globalne zmienne środowiska Node i luzuje reguły, które
 * kolidują ze wzorcami Nesta (np. puste konstruktory przy DI).
 */
export const nestConfig = tseslint.config(...baseConfig, {
  languageOptions: {
    globals: {
      process: "readonly",
      __dirname: "readonly",
      module: "readonly",
    },
    parserOptions: {
      // Nest's DI reads constructor parameter types from the
      // `design:paramtypes` metadata that tsc emits. A type-only import is
      // erased, so the metadata degrades to `Function` and injection fails
      // at runtime. With these flags `consistent-type-imports` knows that
      // imports referenced in decorated signatures are runtime values and
      // stops rewriting them to `import type`.
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
    },
  },
  rules: {
    "@typescript-eslint/no-empty-function": [
      "error",
      { allow: ["constructors"] },
    ],
    // Puste klasy z dekoratorem (@Module, @Injectable, @Controller...) to
    // normalny wzorzec Nesta — DI działa przez metadane dekoratora, nie
    // przez zawartość klasy.
    "@typescript-eslint/no-extraneous-class": [
      "error",
      { allowWithDecorator: true },
    ],
  },
});

export default nestConfig;
