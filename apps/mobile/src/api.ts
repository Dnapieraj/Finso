import { createApiClient } from "@vireo/shared/api";

import { readApiUrl } from "./config";
import { session } from "./session";
import { secureTokenStore } from "./secure-token-store";

/** The app's API client; screens reach it through TanStack Query hooks. */
export const api = createApiClient({
  baseUrl: readApiUrl(process.env.EXPO_PUBLIC_API_URL),
  tokens: secureTokenStore,
  // The refresh token was rejected: the guards send the user to login,
  // and the cached data of the expired session is dropped.
  onSessionExpired: () => void session.signedOut("expired"),
});
