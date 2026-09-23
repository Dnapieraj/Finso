import type { ColorToken, Theme } from "./names.ts";

/**
 * CSS custom property name for a color token: `cardForeground` becomes
 * `--card-foreground`, `chart1` becomes `--chart-1`.
 */
export declare function toCssVariableName(token: ColorToken): string;

/**
 * Renders the theme as the stylesheet committed at `src/styles/theme.css`:
 * light values on `:root`, dark values for the system dark preference
 * (unless the page opts into `.light`) and for an explicit `.dark` class,
 * plus a Tailwind `@theme inline` block that exposes every token as a
 * utility (`bg-safe`, `text-muted-foreground`, `rounded-2xl`, …).
 */
export declare function themeToCss(theme: Theme): string;
