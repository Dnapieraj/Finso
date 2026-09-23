import { describe, expect, it } from "vitest";

import { grosze } from "../money.js";
import { calculateGoalContribution } from "./calculate-goal-contribution.js";

describe("calculateGoalContribution", () => {
  it("dzieli brakującą kwotę równo na pozostałe okresy, zaokrąglając w górę", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(120_000), currentAmount: grosze(0) },
      12,
    );

    expect(result.contributionPerPeriod).toBe(10_000);
    expect(result.alreadyReached).toBe(false);
    expect(result.isOverdue).toBe(false);
  });

  it("brzeg: reszta z dzielenia — ceil(), nie floor() ani round()", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(10_000), currentAmount: grosze(0) },
      3,
    );

    // 10000 / 3 = 3333.33 -> ceil = 3334. floor() dałoby 3333 i cel
    // nigdy nie domknąłby się co do grosza (3333 * 3 = 9999 < 10000).
    expect(result.contributionPerPeriod).toBe(3_334);
  });

  it("bez reszty: ceil() nie dokłada nic, gdy dzieli się równo", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(90_000), currentAmount: grosze(0) },
      3,
    );

    expect(result.contributionPerPeriod).toBe(30_000);
  });

  it("cel już osiągnięty (currentAmount === targetAmount)", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(50_000), currentAmount: grosze(50_000) },
      5,
    );

    expect(result.contributionPerPeriod).toBe(0);
    expect(result.alreadyReached).toBe(true);
    expect(result.isOverdue).toBe(false);
  });

  it("cel przekroczony (currentAmount > targetAmount) też liczy się jako osiągnięty", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(50_000), currentAmount: grosze(60_000) },
      5,
    );

    expect(result.contributionPerPeriod).toBe(0);
    expect(result.alreadyReached).toBe(true);
  });

  it("brzeg: termin dziś (periodsRemaining = 0), cel nieosiągnięty — cała brakująca kwota naraz", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(100_000), currentAmount: grosze(40_000) },
      0,
    );

    expect(result.isOverdue).toBe(true);
    expect(result.alreadyReached).toBe(false);
    expect(result.contributionPerPeriod).toBe(60_000);
  });

  it("brzeg: termin w przeszłości (periodsRemaining < 0) traktowany tak samo jak 0", () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(100_000), currentAmount: grosze(40_000) },
      -3,
    );

    expect(result.isOverdue).toBe(true);
    expect(result.contributionPerPeriod).toBe(60_000);
  });

  it('termin w przeszłości, ale cel już i tak osiągnięty — nie jest "overdue"', () => {
    const result = calculateGoalContribution(
      { targetAmount: grosze(100_000), currentAmount: grosze(100_000) },
      -3,
    );

    expect(result.alreadyReached).toBe(true);
    expect(result.isOverdue).toBe(false);
    expect(result.contributionPerPeriod).toBe(0);
  });
});
