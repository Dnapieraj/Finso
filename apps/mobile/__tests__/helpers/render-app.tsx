import { renderRouter } from "expo-router/testing-library";

import { queryClient } from "../../src/query-client";
import { secureTokenStore } from "../../src/secure-token-store";
import { session } from "../../src/session";

/** Router queries for `expect(app).toHavePathname(...)`. */
export interface RenderedApp {
  getPathname(): string;
  getSegments(): string[];
}

/**
 * Renders the real route tree from `app/` at `initialUrl`. `signedIn`
 * seeds the secure store the way a previous login would have, so the
 * app restores the session on start exactly as on a device.
 */
export async function renderApp(
  initialUrl: string,
  { signedIn }: { signedIn: boolean },
): Promise<RenderedApp> {
  if (signedIn) {
    await secureTokenStore.setTokens({
      accessToken: "access",
      refreshToken: "refresh",
      accessTokenExpiresIn: 900,
    });
  }
  // The session and the query cache are module singletons that outlive each
  // test; a device starts with both empty. Without the restore the first
  // render would use the previous test's status and redirect away from
  // initialUrl; the root layout sees "restoring" and waits for this one.
  queryClient.clear();
  void session.restore();
  const result = renderRouter("./app", { initialUrl });
  await result;
  // Not the awaited value: renderRouter attaches these to the promise itself.
  return { getPathname: () => result.getPathname(), getSegments: () => result.getSegments() };
}
