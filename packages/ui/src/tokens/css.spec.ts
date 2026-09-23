import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { themeToCss, toCssVariableName } from "./css.ts";
import { COLOR_TOKENS, type ColorScale, type Theme } from "./names.ts";
import { theme } from "./palette.ts";

/** Body of the first rule whose selector is exactly `selector`. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No rule for ${selector}`);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

const filled = (value: `#${string}`) =>
  Object.fromEntries(COLOR_TOKENS.map((t) => [t, value])) as ColorScale;

// Obviously fake values, so assertions don't depend on the real palette.
const fixture: Theme = {
  colors: { light: filled("#111111"), dark: filled("#EEEEEE") },
  radius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "12px",
    "2xl": "16px",
    "3xl": "20px",
    "4xl": "24px",
  },
};

describe("toCssVariableName", () => {
  it.each([
    ["background", "--background"],
    ["cardForeground", "--card-foreground"],
    ["safeSubtle", "--safe-subtle"],
    ["chart1", "--chart-1"],
  ] as const)("maps %s to %s", (token, expected) => {
    expect(toCssVariableName(token)).toBe(expected);
  });
});

describe("themeToCss", () => {
  const css = themeToCss(fixture);

  it("puts light values on :root and declares the light color scheme", () => {
    const body = ruleBody(css, ":root");
    expect(body).toContain("color-scheme: light;");
    for (const token of COLOR_TOKENS) {
      expect(body).toContain(`${toCssVariableName(token)}: #111111;`);
    }
  });

  it("follows the system dark preference unless the page opts into .light", () => {
    const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"));
    const body = ruleBody(media, ":root:not(.light)");
    expect(body).toContain("color-scheme: dark;");
    for (const token of COLOR_TOKENS) {
      expect(body).toContain(`${toCssVariableName(token)}: #EEEEEE;`);
    }
  });

  it("applies dark values for an explicit .dark class", () => {
    const body = ruleBody(css, ":root.dark");
    expect(body).toContain("color-scheme: dark;");
    for (const token of COLOR_TOKENS) {
      expect(body).toContain(`${toCssVariableName(token)}: #EEEEEE;`);
    }
  });

  it("exposes every color and radius to Tailwind", () => {
    const body = ruleBody(css, "@theme inline");
    for (const token of COLOR_TOKENS) {
      const name = toCssVariableName(token);
      expect(body).toContain(`--color-${name.slice(2)}: var(${name});`);
    }
    expect(body).toContain("--radius-lg: 10px;");
    expect(body).toContain("--radius-2xl: 16px;");
  });

  it("is deterministic", () => {
    expect(themeToCss(fixture)).toBe(css);
  });
});

describe("src/styles/theme.css", () => {
  it("matches the tokens it is generated from", () => {
    const committed = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");
    // Git on Windows may check the file out with CRLF line endings.
    expect(
      committed.replace(/\r\n/g, "\n"),
      "theme.css is stale: run `pnpm --filter @vireo/ui generate:theme`",
    ).toBe(themeToCss(theme));
  });
});
