/**
 * Every semantic color token in the Vireo design system, in the order they
 * are emitted to CSS. Names follow shadcn/ui so its components work as-is;
 * `safe`, `caution` and `risk` are Finso's "can I afford it" levels.
 *
 * Sidebar tokens from the shadcn template are intentionally absent: the
 * layout is mobile-first and has no sidebar.
 */
export const COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "popover",
  "popoverForeground",
  "primary",
  "primaryForeground",
  "secondary",
  "secondaryForeground",
  "muted",
  "mutedForeground",
  "accent",
  "accentForeground",
  "destructive",
  "border",
  "input",
  "ring",
  "safe",
  "safeSubtle",
  "caution",
  "cautionSubtle",
  "risk",
  "riskSubtle",
  "chart1",
  "chart2",
  "chart3",
  "chart4",
  "chart5",
] as const;

/** Name of a single semantic color token, e.g. `"primaryForeground"`. */
export type ColorToken = (typeof COLOR_TOKENS)[number];

/** Themes every color token must define a value for. */
export const THEMES = ["light", "dark"] as const;

/** A theme name: `"light"` or `"dark"`. */
export type ThemeName = (typeof THEMES)[number];

/**
 * A color as `#RRGGBB`. Hex (not oklch) because React Native, which the
 * mobile app will feed from the same tokens, does not understand oklch.
 */
export type HexColor = `#${string}`;

/** Values of all color tokens for one theme. */
export type ColorScale = Readonly<Record<ColorToken, HexColor>>;

/** Color values for every theme. */
export type ThemeColors = Readonly<Record<ThemeName, ColorScale>>;

/**
 * Corner radii mapped onto Tailwind's own size names (`rounded-lg`, …).
 * Custom names like `rounded-card` would work in CSS, but the `cn` class
 * merger would not know they conflict with `rounded-lg` and keep both.
 */
export type RadiusScale = Readonly<
  Record<"sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl", `${number}px`>
>;

/** The complete set of design tokens that `themeToCss` turns into CSS. */
export interface Theme {
  readonly colors: ThemeColors;
  readonly radius: RadiusScale;
}
