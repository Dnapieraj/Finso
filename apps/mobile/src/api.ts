import { createApiClient } from "@vireo/shared/api";

import { readApiUrl } from "./config";
import { queryClient } from "./query-client";
import { secureTokenStore } from "./secure-token-store";

/** The app's API client; screens reach it through TanStack Query hooks. */
export const api = createApiClient({
  baseUrl: readApiUrl(process.env.EXPO_PUBLIC_API_URL),
  tokens: secureTokenStore,
  // Cached data belongs to the expired session; the next user must not see it.
  onSessionExpired: () => queryClient.clear(),
});
