import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

/**
 * Under "budget": every expense saved, edited or trashed refreshes the
 * budget, and the limits with it — „zostało” must never lag behind.
 */
export const LIMITS_KEY = ["budget", "category-limits"] as const;

/** Limits with what is left this period, and the lean month hints. */
export function useCategoryLimits() {
  return useQuery({ queryKey: LIMITS_KEY, queryFn: () => api.categoryLimits.overview() });
}
