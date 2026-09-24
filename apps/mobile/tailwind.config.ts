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

export default {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors,
      borderRadius: radius,
      fontFamily: {
        heading: ["BricolageGrotesque_700Bold"],
        sans: ["HankenGrotesk_400Regular"],
        "sans-semibold": ["HankenGrotesk_600SemiBold"],
      },
    },
  },
} satisfies Config;
