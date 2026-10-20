import { describe, expect, it } from "vitest";

import { exportDataSchema } from "./schemas.js";

describe("exportDataSchema", () => {
  it("przyjmuje pusty eksport", () => {
    const empty = {
      exportedOn: "2026-10-20",
      categories: [],
      expenses: [],
      incomeSources: [],
      incomeEntries: [],
      goals: [],
      recurringRules: [],
    };

    expect(exportDataSchema.parse(empty)).toEqual(empty);
  });

  it("wydatek ma termin stałej płatności (albo null)", () => {
    const expense = {
      id: "01923b6e-0000-7000-8000-000000000030",
      amount: 150_000,
      date: "2026-10-05",
      categoryId: null,
      recurringRuleId: null,
      note: null,
      status: "CONFIRMED",
      beforeFinso: false,
    };

    expect(
      exportDataSchema.shape.expenses.safeParse([{ ...expense, occurrenceDate: "2026-10-05" }])
        .success,
    ).toBe(true);
    expect(exportDataSchema.shape.expenses.safeParse([expense]).success).toBe(false);
  });
});
