import { describe, expect, it } from "vitest";

import { categoryLimitsOverviewSchema, setCategoryLimitSchema } from "./schemas.js";

const FOOD = "01923b6e-0000-7000-8000-000000000020";

describe("setCategoryLimitSchema", () => {
  it("przyjmuje kwotę w groszach", () => {
    expect(setCategoryLimitSchema.parse({ amount: 80_000 })).toEqual({ amount: 80_000 });
  });

  it.each([
    ["zero", 0],
    ["ujemna", -100],
    ["ułamek grosza", 12.5],
    ["ponad int4", 2_147_483_648],
  ])("odrzuca kwotę: %s", (_case, amount) => {
    expect(setCategoryLimitSchema.safeParse({ amount }).success).toBe(false);
  });
});

describe("categoryLimitsOverviewSchema", () => {
  it("limity ze stanem i chudy okres z podpowiedziami (albo null)", () => {
    const overview = {
      limits: [
        {
          categoryId: FOOD,
          limit: 80_000,
          spent: 90_000,
          left: -10_000,
          perDayLeft: 0,
          state: "over",
        },
      ],
      leanMonth: {
        counted: 300_000,
        typical: 500_000,
        shortfall: 200_000,
        suggestions: [{ categoryId: FOOD, usual: 90_000, suggested: 63_000 }],
      },
    };

    expect(categoryLimitsOverviewSchema.parse(overview)).toEqual(overview);
    expect(categoryLimitsOverviewSchema.parse({ limits: [], leanMonth: null })).toEqual({
      limits: [],
      leanMonth: null,
    });
    expect(
      categoryLimitsOverviewSchema.safeParse({
        ...overview,
        limits: [{ ...overview.limits[0], state: "bad" }],
      }).success,
    ).toBe(false);
  });
});
