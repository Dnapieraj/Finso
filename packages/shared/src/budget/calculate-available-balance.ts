import { daysBetween, isOnOrBefore, type IsoDate } from "../date.js";
import { grosze } from "../money.js";
import type {
  BudgetPeriod,
  CalculateAvailableBalanceInput,
  CalculateAvailableBalanceOutput,
} from "./types.js";

/**
 * Ile użytkownik może swobodnie wydać do końca bieżącego okresu
 * budżetowego, po odjęciu stałych zobowiązań (jeszcze nieopłaconych
 * w tym okresie), rat celów oszczędnościowych i już poniesionych
 * wydatków.
 *
 * `availableBalance = periodIncome - Σ remainingFixedCommitments
 *                      - Σ goalContributions - alreadySpent`
 */
export function calculateAvailableBalance(
  input: CalculateAvailableBalanceInput,
): CalculateAvailableBalanceOutput {
  const fixedCommitments = grosze(
    input.remainingFixedCommitments.reduce((sum, c) => sum + c.amount, 0),
  );
  const goalContributions = grosze(input.goalContributions.reduce((sum, g) => sum + g.amount, 0));

  const availableBalance = grosze(
    input.periodIncome - fixedCommitments - goalContributions - input.alreadySpent,
  );

  const daysRemaining = calculateDaysRemaining(input.period, input.asOf);

  const dailyAllowance = grosze(
    daysRemaining === 0 ? 0 : Math.floor(availableBalance / daysRemaining),
  );

  return {
    availableBalance,
    daysRemaining,
    dailyAllowance,
    breakdown: {
      periodIncome: input.periodIncome,
      fixedCommitments,
      goalContributions,
      alreadySpent: input.alreadySpent,
    },
  };
}

/**
 * Dni pozostałe w okresie, licząc `asOf` jako dzień 1 (inclusive).
 * 0, jeśli okres już się skończył (`asOf` po `period.end`).
 */
function calculateDaysRemaining(period: BudgetPeriod, asOf: IsoDate): number {
  if (!isOnOrBefore(asOf, period.end)) {
    return 0;
  }
  const effectiveStart = isOnOrBefore(period.start, asOf) ? asOf : period.start;
  return daysBetween(effectiveStart, period.end) + 1;
}
