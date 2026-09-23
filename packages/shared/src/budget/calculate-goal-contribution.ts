import type { GoalContributionInput, GoalContributionOutput } from './types.js';

/**
 * Ile odkładać na najbliższy okres, żeby zdążyć z celem przed
 * terminem — przy równym rozłożeniu brakującej kwoty na
 * `periodsRemaining` okresów.
 *
 * `periodsRemaining` to CAŁKOWITA liczba okresów budżetowych do
 * terminu, policzona przez wywołującego (nie data — ten moduł nie zna
 * kalendarza, patrz date.ts). `<= 0` oznacza "termin jest dziś albo
 * już minął" — patrz {@link GoalContributionOutput.isOverdue}.
 *
 * `contributionPerPeriod = ceil((targetAmount - currentAmount) / periodsRemaining)`
 */
export declare function calculateGoalContribution(
  goal: GoalContributionInput,
  periodsRemaining: number,
): GoalContributionOutput;
