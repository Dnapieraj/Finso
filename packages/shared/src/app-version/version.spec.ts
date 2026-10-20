import { describe, expect, it } from "vitest";

import { APP_VERSION_PATTERN, isOlderVersion } from "./version.js";

describe("isOlderVersion", () => {
  it.each([
    ["0.1.0", "0.2.0", true],
    ["0.9.10", "0.10.0", true],
    ["1.2.3", "1.2.4", true],
    ["1.9.9", "2.0.0", true],
    ["1.2.3", "1.2.3", false],
    ["1.10.0", "1.9.0", false],
    ["2.0.0", "1.99.99", false],
  ])("%s starsza niż %s → %s (liczbowo, nie alfabetycznie)", (current, minimum, older) => {
    expect(isOlderVersion(current, minimum)).toBe(older);
  });

  it.each([["abc"], ["1.2"], ["1.2.3-beta"], [""]])(
    "nieczytelna wersja %s nie blokuje appki",
    (current) => {
      expect(isOlderVersion(current, "9.9.9")).toBe(false);
    },
  );
});

describe("APP_VERSION_PATTERN", () => {
  it("major.minor.patch", () => {
    expect(APP_VERSION_PATTERN.test("1.20.3")).toBe(true);
    expect(APP_VERSION_PATTERN.test("1.20")).toBe(false);
  });
});
