import { COLOR_TOKENS } from "./names.ts";
import type { ColorScale, ColorToken, Theme } from "./names.ts";

/**
 * CSS custom property name for a color token: `cardForeground` becomes
 * `--card-foreground`, `chart1` becomes `--chart-1`.
 */
export function toCssVariableName(token: ColorToken): string {
  return `--${token.replace(/[A-Z0-9]/g, (char) => `-${char.toLowerCase()}`)}`;
}

function declarations(scale: ColorScale, scheme: "light" | "dark", indent: string): string {
  const lines = [
    `color-scheme: ${scheme};`,
    ...COLOR_TOKENS.map((token) => `${toCssVariableName(token)}: ${scale[token]};`),
  ];
  return lines.map((line) => `${indent}${line}`).join("\n");
}

/**
 * Renders the theme as the stylesheet committed at `src/styles/theme.css`:
 * light values on `:root`, dark values for the system dark preference
 * (unless the page opts into `.light`) and for an explicit `.dark` class,
 * plus a Tailwind `@theme inline` block that exposes every token as a
 * utility (`bg-safe`, `text-muted-foreground`, `rounded-2xl`, …).
 */
export function themeToCss(theme: Theme): string {
  const { light, dark } = theme.colors;
  const tailwind = [
    ...COLOR_TOKENS.map((token) => {
      const name = toCssVariableName(token);
      return `--color-${name.slice(2)}: var(${name});`;
    }),
    ...Object.entries(theme.radius).map(([size, value]) => `--radius-${size}: ${value};`),
  ];

  return `/*
 * Generated from src/tokens by \`pnpm --filter @vireo/ui generate:theme\`.
 * Do not edit by hand: change the tokens and regenerate.
 */

:root {
${declarations(light, "light", "  ")}
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
${declarations(dark, "dark", "    ")}
  }
}

:root.dark {
${declarations(dark, "dark", "  ")}
}

@theme inline {
${tailwind.map((line) => `  ${line}`).join("\n")}
}
`;
}
