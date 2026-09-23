import "server-only";

import type { AuthTokens } from "@vireo/shared";
import { cookies } from "next/headers";

import { getEnv } from "./env";

/** Cookie names are also read by src/proxy.ts to redirect signed-out users. */
export const ACCESS_COOKIE = "finso_at";
export const REFRESH_COOKIE = "finso_rt";

// Mirrors the API's REFRESH_TOKEN_TTL_DAYS default. If the API is configured
// shorter, the cookie simply outlives the token and the next refresh fails.
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function baseOptions() {
  return {
    // Page scripts can never read the tokens, so an XSS bug cannot steal them.
    httpOnly: true,
    // Browsers accept Secure cookies on http://localhost, but not every one
    // does, so development stays on plain cookies.
    secure: getEnv().NODE_ENV === "production",
    // Lax keeps cookies off cross-site POSTs, which blocks classic CSRF.
    sameSite: "lax" as const,
    path: "/",
  };
}

/** Tokens of the current request; either may be missing. */
export async function readTokens(): Promise<{ accessToken?: string; refreshToken?: string }> {
  const jar = await cookies();
  return {
    accessToken: jar.get(ACCESS_COOKIE)?.value,
    refreshToken: jar.get(REFRESH_COOKIE)?.value,
  };
}

/**
 * Stores a new token pair. Only works inside a Route Handler or Server
 * Function, where Next can attach Set-Cookie headers to the response.
 */
export async function storeTokens(tokens: AuthTokens): Promise<void> {
  const jar = await cookies();
  // The access cookie expires with the token, so an expired token is simply
  // absent and the API client refreshes before calling the API.
  jar.set(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: tokens.accessTokenExpiresIn,
  });
  jar.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

/** Removes both tokens, ending the session in this browser. */
export async function clearTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
