import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast.ts";
import { COLOR_TOKENS, THEMES, type ColorToken } from "./names.ts";
import { colors } from "./palette.ts";

/** WCAG 2.2 AA: 1.4.3 for text, 1.4.11 for UI component boundaries and focus. */
const TEXT = 4.5;
const NON_TEXT = 3;

type Pair = readonly [
  foreground: ColorToken,
  background: ColorToken,
  minimum: number,
];

const REQUIRED_CONTRAST: readonly Pair[] = [
  // Body text on every surface it can sit on.
  ["foreground", "background", TEXT],
  ["cardForeground", "card", TEXT],
  ["popoverForeground", "popover", TEXT],
  ["mutedForeground", "background", TEXT],
  ["mutedForeground", "card", TEXT],
  ["mutedForeground", "muted", TEXT],
  // Text on filled controls.
  ["primaryForeground", "primary", TEXT],
  ["secondaryForeground", "secondary", TEXT],
  ["accentForeground", "accent", TEXT],
  // Colored text: links, errors and "can I afford it" labels.
  ["primary", "background", TEXT],
  ["primary", "card", TEXT],
  ["destructive", "background", TEXT],
  ["destructive", "card", TEXT],
  ["safe", "background", TEXT],
  ["safe", "card", TEXT],
  ["caution", "background", TEXT],
  ["caution", "card", TEXT],
  ["risk", "background", TEXT],
  ["risk", "card", TEXT],
  // Status chips: the label on its own tinted background.
  ["safe", "safeSubtle", TEXT],
  ["caution", "cautionSubtle", TEXT],
  ["risk", "riskSubtle", TEXT],
  // Boundaries a user has to see to operate the UI.
  ["input", "background", NON_TEXT],
  ["input", "card", NON_TEXT],
  ["ring", "background", NON_TEXT],
  ["ring", "card", NON_TEXT],
  // Chart marks against the card they are drawn on.
  ["chart1", "card", NON_TEXT],
  ["chart2", "card", NON_TEXT],
  ["chart3", "card", NON_TEXT],
  ["chart4", "card", NON_TEXT],
  ["chart5", "card", NON_TEXT],
];

describe.each(THEMES)("%s palette", (themeName) => {
  const scale = colors[themeName];

  it.each(COLOR_TOKENS)("defines %s as uppercase #RRGGBB", (token) => {
    expect(scale[token]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it.each(REQUIRED_CONTRAST)(
    "%s on %s reaches %d:1",
    (foreground, background, minimum) => {
      expect(
        contrastRatio(scale[foreground], scale[background]),
      ).toBeGreaterThanOrEqual(minimum);
    },
  );

  it("keeps the three affordability levels visually distinct", () => {
    const levels = [scale.safe, scale.caution, scale.risk];
    expect(new Set(levels).size).toBe(levels.length);
  });

  it("does not reuse the brand green as the 'safe' green", () => {
    // Direction A's known weak spot: if these matched, every primary button
    // would read as "you can afford it".
    expect(scale.safe).not.toBe(scale.primary);
  });

  it("uses five different chart colors", () => {
    const chart = [
      scale.chart1,
      scale.chart2,
      scale.chart3,
      scale.chart4,
      scale.chart5,
    ];
    expect(new Set(chart).size).toBe(chart.length);
  });
});

it("gives the dark theme its own values instead of reusing light ones", () => {
  expect(colors.dark.background).not.toBe(colors.light.background);
  expect(colors.dark.foreground).not.toBe(colors.light.foreground);
  expect(colors.dark.primary).not.toBe(colors.light.primary);
});
