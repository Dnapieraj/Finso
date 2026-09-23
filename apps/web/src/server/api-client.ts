import "server-only";

import { authTokensSchema, type AuthTokens } from "@vireo/shared";

import { getEnv } from "./env";
import { clearTokens, readTokens, storeTokens } from "./session";

/*
 * The API rotates refresh tokens and treats a second use of the same token as
 * theft: it revokes the whole session. A dashboard fires several requests at
 * once, and after the 15-minute access token expires each would try to
 * refresh with the same token. So refreshes are single-flight per token, and
 * the result is kept for a short while for requests that were already in
 * flight with the old cookie.
 *
 * Limitation: this map lives in one Node process. Running several web
 * instances needs a shared store or a reuse grace period in the API.
 */
const REFRESH_RESULT_TTL_MS = 30_000;
const refreshes = new Map<string, Promise<AuthTokens | null>>();

function refreshOnce(refreshToken: string): Promise<AuthTokens | null> {
  const pending = refreshes.get(refreshToken);
  if (pending) return pending;

  const request = fetch(`${getEnv().API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  })
    .then(async (response) => (response.ok ? authTokensSchema.parse(await response.json()) : null))
    .catch(() => null)
    .finally(() => {
      setTimeout(() => refreshes.delete(refreshToken), REFRESH_RESULT_TTL_MS);
    });

  refreshes.set(refreshToken, request);
  return request;
}

/** Refreshes the session and updates or clears the cookies accordingly. */
async function renew(refreshToken: string): Promise<AuthTokens | null> {
  const tokens = await refreshOnce(refreshToken);
  if (tokens) {
    await storeTokens(tokens);
  } else {
    await clearTokens();
  }
  return tokens;
}

function send(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  return fetch(`${getEnv().API_URL}${path}`, { ...init, headers, cache: "no-store" });
}

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/**
 * Calls the API on behalf of the signed-in user. Attaches the access token
 * from the cookie, refreshes it when missing or rejected, and retries once.
 * Returns 401 when there is no usable session.
 *
 * Must run in a Route Handler: refreshing rewrites the session cookies.
 */
export async function callApi(path: string, init: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken } = await readTokens();

  let token = accessToken;
  if (!token && refreshToken) {
    token = (await renew(refreshToken))?.accessToken;
  }
  if (!token) return unauthorized();

  const response = await send(path, init, token);
  if (response.status !== 401 || !refreshToken) return response;

  const renewed = await renew(refreshToken);
  return renewed ? send(path, init, renewed.accessToken) : unauthorized();
}
