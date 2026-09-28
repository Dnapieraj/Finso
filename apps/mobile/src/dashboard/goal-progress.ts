import type { Goal } from "@vireo/shared";

/** `reached` wins over `overdue`: a goal met late is still met. */
export type GoalState = "on-track" | "reached" | "overdue";

/**
 * Percent saved, rounded down (99.9% must not read as done) and capped at
 * 100. `asOf` is the API's "today" in the user's time zone; without it the
 * goal cannot be called overdue.
 */
export function goalProgress(
  goal: Pick<Goal, "targetAmount" | "currentAmount" | "targetDate">,
  asOf: string | null,
): { percent: number; state: GoalState } {
  const percent = Math.min(100, Math.floor((goal.currentAmount * 100) / goal.targetAmount));
  if (goal.currentAmount >= goal.targetAmount) return { percent, state: "reached" };
  // ISO dates compare correctly as strings.
  if (asOf !== null && goal.targetDate < asOf) return { percent, state: "overdue" };
  return { percent, state: "on-track" };
}
