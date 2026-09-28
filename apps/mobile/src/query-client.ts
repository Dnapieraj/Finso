import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@vireo/shared/api";

const MAX_RETRIES = 2;

/**
 * Retries only what a retry can fix: a dropped connection or a 5xx.
 * A 4xx repeats the same answer (and every 401 would refresh the session
 * again); an invalid response or a bug in the app is not transient.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || !(error instanceof ApiError)) return false;
  if (error.kind === "network") return true;
  return error.kind === "http" && error.status !== null && error.status >= 500;
}

/** The app's single query cache; cleared when the session ends. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetry } },
});
