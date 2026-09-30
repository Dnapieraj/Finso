import { useQuery } from "@tanstack/react-query";
import {
  currentBudgetPeriod,
  isoDate,
  todayInTimeZone,
  type BudgetPeriod,
  type IsoDate,
} from "@vireo/shared";

import { api } from "../api";
import { useAccount } from "../auth/account";
import { useBudget } from "../dashboard/queries";
import { queryClient } from "../query-client";

export const INCOME_SOURCES_KEY = ["income-sources"] as const;
export const RECURRING_RULES_KEY = ["recurring-rules"] as const;

/** Income sources with their schedules (archived ones too; screens filter). */
export function useIncomeSources() {
  return useQuery({ queryKey: INCOME_SOURCES_KEY, queryFn: () => api.incomeSources.list() });
}

/** Recurring rules of both kinds (inactive ones too; screens filter). */
export function useRecurringRules() {
  return useQuery({ queryKey: RECURRING_RULES_KEY, queryFn: () => api.recurringRules.list() });
}

/**
 * After any change to what the budget is computed from: the dashboard and
 * a simulation already on screen ask the API again, so they never show
 * numbers from before the change.
 */
export function refreshBudget(): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["budget"] }),
    queryClient.invalidateQueries({ queryKey: ["simulation"] }),
  ]).then(() => undefined);
}

/**
 * "Today" and the current period, which a new rule's start date depends
 * on. The budget's own answer when loaded — computed in the user's zone
 * by the API; otherwise the same calculation from the account's settings.
 */
export function useBudgetClock(): () => { today: IsoDate; period: BudgetPeriod } {
  const budget = useBudget();
  const account = useAccount();
  return () => {
    if (budget.data) {
      const { asOf, period } = budget.data;
      return {
        today: isoDate(asOf),
        period: { start: isoDate(period.start), end: isoDate(period.end) },
      };
    }
    const today = todayInTimeZone(new Date(), account.timezone);
    return { today, period: currentBudgetPeriod(today, account.periodStartDay) };
  };
}
