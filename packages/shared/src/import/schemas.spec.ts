import { describe, expect, it } from "vitest";

import { importResultSchema, importTransactionsSchema, IMPORT_MAX_ROWS } from "./schemas.js";

const row = { date: "2026-10-03", amount: 4_590, note: "BIEDRONKA" };

describe("importTransactionsSchema", () => {
  it("wiersze: data, kwota w groszach, notatka (może być pusta)", () => {
    expect(importTransactionsSchema.parse({ rows: [row, { ...row, note: null }] })).toEqual({
      rows: [row, { ...row, note: null }],
    });
  });

  it.each([
    ["bez wierszy", { rows: [] }],
    ["za dużo wierszy", { rows: Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => row) }],
    ["zła data", { rows: [{ ...row, date: "2026-02-30" }] }],
    ["kwota 0", { rows: [{ ...row, amount: 0 }] }],
    ["notatka ponad 500 znaków", { rows: [{ ...row, note: "x".repeat(501) }] }],
  ])("odrzuca: %s", (_case, body) => {
    expect(importTransactionsSchema.safeParse(body).success).toBe(false);
  });
});

describe("importResultSchema", () => {
  it("ile zapisano i ile pominięto jako już zapisane", () => {
    expect(importResultSchema.parse({ imported: 3, duplicates: 1 })).toEqual({
      imported: 3,
      duplicates: 1,
    });
  });
});
