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
