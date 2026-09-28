import { renderRouter } from "expo-router/testing-library";

import { secureTokenStore } from "../../src/secure-token-store";

/**
 * Renders the real route tree from `app/` at `initialUrl`. `signedIn`
 * seeds the secure store the way a previous login would have, so the
 * app restores the session on start exactly as on a device.
 */
export async function renderApp(initialUrl: string, { signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    await secureTokenStore.setTokens({
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresIn: 900,
    });
  }
  const result = renderRouter("./app", { initialUrl });
  await result;
  return result;
}
