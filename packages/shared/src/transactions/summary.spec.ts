import { describe, expect, it } from "vitest";

import { transactionSummaryQuerySchema, transactionSummarySchema } from "./schemas.js";

const CATEGORY_ID = "00000000-0000-7000-8000-000000000001";

describe("GET /transactions/summary", () => {
  describe("query", () => {
    it("wymaga zakresu dat: od i do (włącznie)", () => {
      expect(transactionSummaryQuerySchema.parse({ from: "2026-09-10", to: "2026-10-09" })).toEqual(
        { from: "2026-09-10", to: "2026-10-09" },
      );
      expect(transactionSummaryQuerySchema.safeParse({ from: "2026-09-10" }).success).toBe(false);
      expect(transactionSummaryQuerySchema.safeParse({ to: "2026-10-09" }).success).toBe(false);
    });

    it("jeden dzień to poprawny zakres", () => {
      expect(
        transactionSummaryQuerySchema.safeParse({ from: "2026-09-10", to: "2026-09-10" }).success,
      ).toBe(true);
    });

    it("„od” po „do” to błąd, nie pusta odpowiedź", () => {
      const result = transactionSummaryQuerySchema.safeParse({
        from: "2026-10-10",
        to: "2026-10-09",
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]).toMatchObject({ path: ["to"], message: "before_from" });
    });
  });

  it("odpowiedź: suma i liczba wydatków na kategorię; null = bez kategorii", () => {
    const summary = {
      total: 75_000,
      count: 5,
      byCategory: [
        { categoryId: CATEGORY_ID, amount: 45_000, count: 3 },
        { categoryId: null, amount: 30_000, count: 2 },
      ],
    };

    expect(transactionSummarySchema.parse(summary)).toEqual(summary);
    expect(
      transactionSummarySchema.safeParse({ ...summary, byCategory: [{ categoryId: null }] })
        .success,
    ).toBe(false);
  });
});
