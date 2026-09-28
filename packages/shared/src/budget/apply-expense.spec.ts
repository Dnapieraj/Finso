import { describe, expect, it } from "vitest";

import { grosze } from "../money.js";
import { addExpenseToSummary, removeExpenseFromSummary } from "./apply-expense.js";
import type { BudgetSummary } from "./schemas.js";

/** Dzień 19 z 30: 1234,56 zł na 12 dni. */
const summary: BudgetSummary = {
  period: { start: "2026-09-10", end: "2026-10-09" },
  asOf: "2026-09-28",
  availableBalance: 123_456,
  daysRemaining: 12,
  dailyAllowance: 10_288,
  breakdown: {
    periodIncome: 500_000,
    fixedCommitments: 150_000,
    goalContributions: 50_000,
    alreadySpent: 176_544,
  },
  fixedCommitments: [{ label: "Czynsz", amount: 150_000 }],
  goalContributions: [{ goalId: "01923b6e-0000-7000-8000-000000000010", amount: 50_000 }],
};

describe("addExpenseToSummary", () => {
  it("odejmuje wydatek od salda i dolicza go do wydanych", () => {
    const after = addExpenseToSummary(summary, grosze(4_590));

    expect(after.availableBalance).toBe(118_866);
    expect(after.breakdown.alreadySpent).toBe(181_134);
  });

  it("liczy kwotę dzienną tak jak silnik: floor(saldo / dni) — reszta groszy zostaje", () => {
    // floor(118 866 / 12) = floor(9905,5) = 9905
    expect(addExpenseToSummary(summary, grosze(4_590)).dailyAllowance).toBe(9_905);
  });

  it("zgadza się z pełnym przeliczeniem silnika", () => {
    const after = addExpenseToSummary(summary, grosze(4_590));
    const { periodIncome, fixedCommitments, goalContributions, alreadySpent } = after.breakdown;

    expect(after.availableBalance).toBe(
      periodIncome - fixedCommitments - goalContributions - alreadySpent,
    );
  });

  it("może zejść pod kreskę; kwota dzienna zaokrąglona w stronę -∞", () => {
    const after = addExpenseToSummary({ ...summary, availableBalance: 1_000 }, grosze(5_000));

    expect(after.availableBalance).toBe(-4_000);
    // floor(-4000 / 12) = floor(-333,3) = -334 — większy dług, bezpieczniej
    expect(after.dailyAllowance).toBe(-334);
  });

  it("przy zerowym dochodzie saldo po prostu spada poniżej zera", () => {
    const empty: BudgetSummary = {
      ...summary,
      availableBalance: 0,
      dailyAllowance: 0,
      breakdown: { periodIncome: 0, fixedCommitments: 0, goalContributions: 0, alreadySpent: 0 },
    };

    const after = addExpenseToSummary(empty, grosze(1_200));

    expect(after.availableBalance).toBe(-1_200);
    expect(after.dailyAllowance).toBe(-100);
  });

  it("po końcu okresu (0 dni) kwota dzienna zostaje 0", () => {
    expect(
      addExpenseToSummary({ ...summary, daysRemaining: 0 }, grosze(4_590)).dailyAllowance,
    ).toBe(0);
  });

  it("nie zmienia pozostałych pól ani obiektu wejściowego", () => {
    const before = structuredClone(summary);

    const after = addExpenseToSummary(summary, grosze(4_590));

    expect(summary).toEqual(before);
    expect(after.period).toEqual(summary.period);
    expect(after.fixedCommitments).toEqual(summary.fixedCommitments);
    expect(after.breakdown.periodIncome).toBe(summary.breakdown.periodIncome);
  });

  it.each([0, -100])("odrzuca kwotę %i — wydatek jest zawsze dodatni", (amount) => {
    expect(() => addExpenseToSummary(summary, grosze(amount))).toThrow(RangeError);
  });
});

describe("removeExpenseFromSummary", () => {
  it("jest dokładną odwrotnością dodania (cofnięcie wydatku)", () => {
    const added = addExpenseToSummary(summary, grosze(4_590));

    expect(removeExpenseFromSummary(added, grosze(4_590))).toEqual(summary);
  });

  it("wraca spod kreski nad kreskę", () => {
    const below = { ...summary, availableBalance: -4_000, dailyAllowance: -334 };

    const after = removeExpenseFromSummary(below, grosze(5_000));

    expect(after.availableBalance).toBe(1_000);
    expect(after.dailyAllowance).toBe(83);
  });

  it.each([0, -100])("odrzuca kwotę %i", (amount) => {
    expect(() => removeExpenseFromSummary(summary, grosze(amount))).toThrow(RangeError);
  });
});
