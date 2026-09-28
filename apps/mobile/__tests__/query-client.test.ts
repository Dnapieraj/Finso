import { ApiError } from "@vireo/shared/api";

import { shouldRetry } from "../src/query-client";

// Retrying a 4xx only repeats the same answer (and a 401 would trigger
// three more refreshes); a dropped connection or a 5xx may pass on retry.
it.each([
  ["network error", new ApiError("network", null, ""), 0, true],
  ["network error", new ApiError("network", null, ""), 1, true],
  ["network error after two retries", new ApiError("network", null, ""), 2, false],
  ["503", new ApiError("http", 503, ""), 0, true],
  ["401", new ApiError("http", 401, ""), 0, false],
  ["404", new ApiError("http", 404, ""), 0, false],
  ["429", new ApiError("http", 429, ""), 0, false],
  ["invalid response", new ApiError("invalid-response", 200, ""), 0, false],
  ["a bug in the app", new TypeError("x is undefined"), 0, false],
] as const)("%s (failure %i) → retry: %s", (_case, error, failureCount, expected) => {
  expect(shouldRetry(failureCount, error)).toBe(expected);
});
