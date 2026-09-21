// @ts-check
import nextPlugin from "eslint-config-next";
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.js";

/**
 * Konfiguracja ESLint dla apps/web (Next.js App Router).
 * Dokłada oficjalne reguły next/core-web-vitals do naszej bazowej
 * konfiguracji (typescript-eslint strict + stylistic).
 */
export const nextConfig = tseslint.config(...baseConfig, ...nextPlugin);

export default nextConfig;
