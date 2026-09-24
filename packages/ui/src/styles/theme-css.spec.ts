import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { theme, themeToCss } from "@vireo/tokens";

describe("src/styles/theme.css", () => {
  it("matches the tokens it is generated from", () => {
    const committed = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
    // Git on Windows may check the file out with CRLF line endings.
    expect(
      committed.replace(/\r\n/g, "\n"),
      "theme.css is stale: run `pnpm --filter @vireo/ui generate:theme`",
    ).toBe(themeToCss(theme));
  });
});
