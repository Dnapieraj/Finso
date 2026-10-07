import type { Config } from "tailwindcss";
import nativewindPreset from "nativewind/preset";

import { COLOR_TOKENS, radius, toCssVariableName } from "@vireo/tokens";

/*
 * Tailwind 3 config for NativeWind 4 (web stays on Tailwind 4). Colors are
 * CSS variables named after the Vireo tokens; the root layout fills them
 * with the light or dark palette, so `bg-card` follows the system theme
 * without `dark:` variants. Tailwind loads this file through jiti, which
 * reads @vireo/tokens straight from TypeScript: no generated copy.
 */
const colors = Object.fromEntries(
  COLOR_TOKENS.map((token) => {
    const variable = toCssVariableName(token);
    return [variable.slice(2), `var(${variable})`];
  }),
);

/*
 * Tailwind's default type scale (size, line height in rem), multiplied by
 * --text-scale, which the root layout sets from Settings → Wygląd. Only
 * text grows; spacing and icons keep their size. The phone's own font size
 * still applies on top, as React Native scales every Text by it.
 */
const TYPE_SCALE = {
  xs: [0.75, 1],
  sm: [0.875, 1.25],
  base: [1, 1.5],
  lg: [1.125, 1.75],
  xl: [1.25, 1.75],
  "2xl": [1.5, 2],
  "3xl": [1.875, 2.25],
  "4xl": [2.25, 2.5],
  // Tailwind gives 5xl a unitless line height of 1, i.e. the font size itself.
  "5xl": [3, 3],
} as const;

const scaled = (rem: number) => `calc(${String(rem)}rem * var(--text-scale))`;

const fontSize = Object.fromEntries(
  Object.entries(TYPE_SCALE).map(([name, [size, lineHeight]]) => [
    name,
    [scaled(size), { lineHeight: scaled(lineHeight) }] as [string, { lineHeight: string }],
  ]),
);

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      fontSize,
      fontFamily: {
        heading: ["BricolageGrotesque_700Bold"],
        sans: ["HankenGrotesk_400Regular"],
        "sans-semibold": ["HankenGrotesk_600SemiBold"],
      },
    },
  },
} satisfies Config;
