import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

export const TEMPLATES_KEY = ["expense-templates"] as const;

/** Quick add templates, in the order they were added. */
export function useTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => api.expenseTemplates.list() });
}

/**
 * Enough of the newest expenses to find four different ones for the quick
 * add. Under "transactions", so every save refreshes it with the rest.
 */
const RECENT_FOR_PICKS = { status: "CONFIRMED", limit: 30 } as const;

export function useRecentForPicks() {
  return useQuery({
    queryKey: ["transactions", RECENT_FOR_PICKS],
    queryFn: () => api.transactions.list(RECENT_FOR_PICKS),
  });
}
