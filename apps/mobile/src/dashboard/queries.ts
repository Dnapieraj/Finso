import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

/** Only confirmed expenses: the ones the budget engine counts. */
const RECENT_EXPENSES = { status: "CONFIRMED", limit: 5 } as const;

/** Cache keys the quick add updates optimistically. */
export const BUDGET_KEY = ["budget", "current"] as const;
export const RECENT_EXPENSES_KEY = ["transactions", RECENT_EXPENSES] as const;

/** The current budget period: what is left and per day. */
export function useBudget() {
  return useQuery({ queryKey: BUDGET_KEY, queryFn: () => api.budget.current() });
}

/** Goals, nearest target date first. */
export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => api.goals.list() });
}

/** Categories, to name the expenses. They rarely change, so kept for a while. */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.categories.list(),
    staleTime: 60 * 60 * 1000,
  });
}

/** The latest confirmed expenses. */
export function useRecentExpenses() {
  return useQuery({
    queryKey: RECENT_EXPENSES_KEY,
    queryFn: () => api.transactions.list(RECENT_EXPENSES),
  });
}
