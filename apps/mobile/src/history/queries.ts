import { useInfiniteQuery, useQuery, type InfiniteData } from "@tanstack/react-query";

import type { BudgetPeriod, Transaction, TransactionPage } from "@vireo/shared";

import { api } from "../api";
import { queryClient } from "../query-client";
import { refreshBudget } from "../settings/queries";

/** How many expenses one page of the history loads. */
export const HISTORY_PAGE_SIZE = 20;

/**
 * Confirmed expenses of a period (optionally one category), newest first,
 * page by page. Keys start with "transactions", so every change to an
 * expense (quick add included) refreshes them.
 */
export function useHistory(period: BudgetPeriod, categoryId: string | null) {
  return useInfiniteQuery({
    queryKey: ["transactions", "history", period.start, period.end, categoryId],
    queryFn: ({ pageParam }) =>
      api.transactions.list({
        from: period.start,
        to: period.end,
        ...(categoryId ? { categoryId } : {}),
        status: "CONFIRMED",
        limit: HISTORY_PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** Spending of the period by category, summed by the API. */
export function useSpendingByCategory(period: BudgetPeriod) {
  return useQuery({
    queryKey: ["transactions", "summary", period.start, period.end],
    queryFn: () => api.transactions.summary({ from: period.start, to: period.end }),
  });
}

/** The expense `id` from a history page already loaded, if any. */
function fromHistory(id: string): Transaction | undefined {
  for (const [, data] of queryClient.getQueriesData<InfiniteData<TransactionPage>>({
    queryKey: ["transactions", "history"],
  })) {
    const found = data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * One expense, for the edit screen. Opened from the history it starts
 * from the row already on screen — no loading state; the API still
 * confirms it. Opened by a link, it is fetched.
 */
export function useExpense(id: string) {
  return useQuery({
    queryKey: ["transactions", "one", id],
    queryFn: () => api.transactions.get(id),
    initialData: () => fromHistory(id),
  });
}

/**
 * After an expense changed: the history, the chart, the dashboard's recent
 * expenses, the budget and any simulation on screen ask the API again.
 */
export function refreshAfterExpenseChange(): void {
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void refreshBudget();
}
