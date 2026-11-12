import { daysBetween, type IsoDate } from "../date.js";
import { grosze, type Grosze } from "../money.js";
import { calculateAvailableBalance } from "./calculate-available-balance.js";
import type {
  GoalImpact,
  RiskLevel,
  SimulatedGoal,
  SimulatePurchaseInput,
  SimulatePurchaseOutput,
} from "./types.js";

const DEFAULT_TIGHT_THRESHOLD_RATIO = 0.5;

/**
 * Symuluje planowany zakup: czy stać, ile zostanie, ile dziennie do
 * końca okresu, i o ile opóźni każdy aktywny cel (patrz
 * {@link GoalImpact} po uzasadnienie modelu).
 *
 * Wewnętrznie woła calculateAvailableBalance(input) po stan "przed",
 * więc `input` to dokładnie to samo, czego oczekuje ta funkcja —
 * rozszerzone tylko o cele i próg 'tight'.
 *
 * Bez kategorii: Faza 1 nie ma limitów per kategoria, więc kategoria nie
 * zmieniłaby wyniku. Wróci jako parametr razem z limitami (Faza 2).
 */
export function simulatePurchase(
  input: SimulatePurchaseInput,
  amountInGrosze: Grosze,
): SimulatePurchaseOutput {
  const before = calculateAvailableBalance(input);
  const remainingAfter = grosze(before.availableBalance - amountInGrosze);
  const dailyAllowanceAfter = grosze(
    before.daysRemaining === 0 ? 0 : Math.floor(remainingAfter / before.daysRemaining),
  );

  const canAfford = remainingAfter >= 0;
  const tightThresholdRatio = input.tightThresholdRatio ?? DEFAULT_TIGHT_THRESHOLD_RATIO;
  const riskLevel = calculateRiskLevel(
    canAfford,
    before.dailyAllowance,
    dailyAllowanceAfter,
    tightThresholdRatio,
  );

  // Ile faktycznie zabraknie po tym zakupie — 0, jeśli i tak starczyło.
  const deficit = Math.max(0, 0 - remainingAfter);
  // Wpłacone już w tym okresie pieniądze są na celu — zakup ich nie zabierze.
  const contributionByGoalId = new Map(
    input.goalContributions.map((line) => [
      line.goalId,
      grosze(Math.max(0, line.amount - (line.deposited ?? 0))),
    ]),
  );

  const goalImpacts: GoalImpact[] = input.goals.map((goal) => ({
    goalId: goal.id,
    delayDays: calculateGoalDelayDays(
      goal,
      contributionByGoalId.get(goal.id) ?? grosze(0),
      deficit,
      input.asOf,
    ),
  }));

  return { canAfford, remainingAfter, dailyAllowanceAfter, goalImpacts, riskLevel };
}

/**
 * `dailyAllowanceBefore <= 0` (np. budżet już wcześniej tak ciasny, że
 * dzienna kwota rundowała do zera): traktujemy to jako 'tight' zamiast
 * dzielić przez zero — patrz test "budżet już przed zakupem tak ciasny...".
 */
function calculateRiskLevel(
  canAfford: boolean,
  dailyAllowanceBefore: Grosze,
  dailyAllowanceAfter: Grosze,
  tightThresholdRatio: number,
): RiskLevel {
  if (!canAfford) {
    return "over";
  }
  if (dailyAllowanceBefore <= 0) {
    return "tight";
  }
  const ratio = dailyAllowanceAfter / dailyAllowanceBefore;
  return ratio < tightThresholdRatio ? "tight" : "safe";
}

function calculateGoalDelayDays(
  goal: SimulatedGoal,
  contributionThisPeriod: Grosze,
  deficit: number,
  asOf: IsoDate,
): number {
  if (deficit <= 0) {
    return 0;
  }
  const remainingNeeded = goal.targetAmount - goal.currentAmount;
  if (remainingNeeded <= 0) {
    return 0; // cel już osiągnięty
  }
  const daysUntilTarget = daysBetween(asOf, goal.targetDate);
  if (daysUntilTarget <= 0) {
    return 0; // termin już minął — nie ma względem czego liczyć opóźnienia
  }

  const affectedAmount = Math.min(deficit, contributionThisPeriod);
  if (affectedAmount <= 0) {
    return 0;
  }

  const dailyRate = remainingNeeded / daysUntilTarget;
  return Math.ceil(affectedAmount / dailyRate);
}
