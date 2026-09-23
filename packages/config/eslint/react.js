// @ts-check
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.js";

/**
 * Konfiguracja ESLint dla pakietów z komponentami React poza Next.js
 * (np. @vireo/ui). apps/web dostaje te same reguły przez eslint-config-next.
 *
 * `exhaustive-deps` podnosimy z ostrzeżenia do błędu: CI przepuszcza
 * ostrzeżenia, a brakująca zależność efektu to realny błąd, nie styl.
 */
export const reactConfig = tseslint.config(...baseConfig, reactHooks.configs.flat.recommended, {
  rules: {
    "react-hooks/exhaustive-deps": "error",
  },
});

export default reactConfig;
