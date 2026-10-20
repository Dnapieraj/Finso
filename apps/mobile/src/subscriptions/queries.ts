import { useQuery } from "@tanstack/react-query";

import { api } from "../api";

export const SUBSCRIPTIONS_KEY = ["subscriptions"] as const;

/**
 * Confirmed and detected subscriptions. Detected ones are worked out from
 * the expense history on every request, so the list is refetched whenever
 * a screen showing it mounts.
 */
export function useSubscriptions() {
  return useQuery({ queryKey: SUBSCRIPTIONS_KEY, queryFn: () => api.subscriptions.overview() });
}
