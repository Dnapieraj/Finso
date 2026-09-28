import { grosze, type Grosze } from "../money.js";
import { calculateDailyAllowance } from "./calculate-available-balance.js";
import type { BudgetSummary } from "./schemas.js";

/**
 * Stan budżetu po dodaniu wydatku z bieżącego okresu — bez pytania API.
 * Aplikacja pokazuje go od razu (optimistic update), zanim serwer
 * potwierdzi zapis; wynik jest taki sam, jaki policzyłby silnik, bo
 * wydatek tylko zwiększa `alreadySpent`.
 *
 * @throws {RangeError} gdy `amount` nie jest dodatnie.
 */
export function addExpenseToSummary(summary: BudgetSummary, amount: Grosze): BudgetSummary {
  assertPositive(amount);
  return shiftSpent(summary, amount);
}

/**
 * Odwrotność {@link addExpenseToSummary} — np. gdy użytkownik cofnie
 * właśnie zapisany wydatek.
 *
 * @throws {RangeError} gdy `amount` nie jest dodatnie.
 */
export function removeExpenseFromSummary(summary: BudgetSummary, amount: Grosze): BudgetSummary {
  assertPositive(amount);
  return shiftSpent(summary, grosze(0 - amount));
}

function assertPositive(amount: Grosze): void {
  if (amount <= 0) {
    throw new RangeError(`Kwota wydatku musi być dodatnia, otrzymano: ${String(amount)} gr.`);
  }
}

function shiftSpent(summary: BudgetSummary, delta: Grosze): BudgetSummary {
  const availableBalance = grosze(summary.availableBalance - delta);
  return {
    ...summary,
    availableBalance,
    dailyAllowance: calculateDailyAllowance(availableBalance, summary.daysRemaining),
    breakdown: {
      ...summary.breakdown,
      alreadySpent: summary.breakdown.alreadySpent + delta,
    },
  };
}
