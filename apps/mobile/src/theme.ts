import { vars } from "nativewind";

import { COLOR_TOKENS, theme, toCssVariableName, type ThemeName } from "@vireo/tokens";

function paletteVars(name: ThemeName) {
  return vars(
    Object.fromEntries(
      COLOR_TOKENS.map((token) => [toCssVariableName(token), theme.colors[name][token]]),
    ),
  );
}

/**
 * Styles that fill the Tailwind color variables (see tailwind.config.ts)
 * with one Vireo palette. Applied once at the root, so every `bg-*` and
 * `text-*` class below switches with the system theme.
 */
export const themeVars: Record<ThemeName, ReturnType<typeof vars>> = {
  light: paletteVars("light"),
  dark: paletteVars("dark"),
};

/**
 * The `--text-scale` variable every font size in tailwind.config.ts is
 * multiplied by: "Rozmiar tekstu" in Settings → Wygląd.
 */
export function textScaleVars(scale: number) {
  return vars({ "--text-scale": scale });
}
