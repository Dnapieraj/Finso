import { describe, expect, it, vi } from "vitest";

import type { AuthTokens } from "../auth/schemas.js";
import { ApiError, createApiClient, type TokenStore } from "./client.js";

const BASE_URL = "https://api.finso.test";

const oldTokens: AuthTokens = {
  accessToken: "access-old",
  refreshToken: "refresh-old",
  accessTokenExpiresIn: 900,
};
const newTokens: AuthTokens = {
  accessToken: "access-new",
  refreshToken: "refresh-new",
  accessTokenExpiresIn: 900,
};

const me = {
  id: "01923b6e-0000-7000-8000-000000000001",
  email: "ola@example.com",
  plan: "FREE",
  currency: "PLN",
  timezone: "Europe/Warsaw",
  periodStartDay: 10,
} as const;

const credentials = { email: "ola@example.com", password: "tajne-haslo-123" };

/** TokenStore kept in memory; `saved` shows what the client stored. */
function memoryTokenStore(initial: AuthTokens | null = oldTokens) {
  const store: TokenStore & { saved: AuthTokens | null } = {
    saved: initial,
    getAccessToken: () => Promise.resolve(store.saved?.accessToken ?? null),
    getRefreshToken: () => Promise.resolve(store.saved?.refreshToken ?? null),
    setTokens: (tokens: AuthTokens) => {
      store.saved = tokens;
      return Promise.resolve();
    },
    clear: () => {
      store.saved = null;
      return Promise.resolve();
    },
  };
  return store;
}

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type Route = Response[] | ((init: RequestInit) => Response | Promise<Response>);

/**
 * Fake fetch answering by "METHOD /path". A list of responses is served in
 * order; a function decides per request. Anything else fails the test.
 */
function fakeFetch(routes: Record<string, Route>) {
  return vi.fn(async (url: string, init: RequestInit) => {
    const key = `${init.method ?? "GET"} ${new URL(url).pathname}`;
    const route = routes[key];
    const response = typeof route === "function" ? await route(init) : route?.shift();
    if (!response) throw new Error(`Unexpected request: ${key}`);
    return response;
  });
}

function setup(routes: Record<string, Route>, tokens = memoryTokenStore()) {
  const fetch = fakeFetch(routes);
  const onSessionExpired = vi.fn();
  const api = createApiClient({ baseUrl: BASE_URL, tokens, fetch, onSessionExpired });
  return { api, fetch, tokens, onSessionExpired };
}

/** URL, method, headers and parsed JSON body of the n-th request. */
function sentRequest(fetch: ReturnType<typeof fakeFetch>, n: number) {
  const [url, init] = fetch.mock.calls[n] ?? ["", {}];
  return {
    url,
    method: init.method ?? "GET",
    headers: new Headers(init.headers),
    body: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
  };
}

describe("createApiClient", () => {
  it.each([
    ["login", "/auth/login", 200],
    ["register", "/auth/register", 201],
  ] as const)(
    "%s validates the session against the shared schema and stores the tokens",
    async (action, path, status) => {
      const { api, fetch, tokens } = setup(
        { [`POST ${path}`]: [jsonResponse(status, { ...newTokens, user: me })] },
        memoryTokenStore(null),
      );

      await expect(api.auth[action](credentials)).resolves.toEqual(me);

      const request = sentRequest(fetch, 0);
      expect(request.url).toBe(`${BASE_URL}${path}`);
      expect(request.method).toBe("POST");
      expect(request.headers.get("Content-Type")).toBe("application/json");
      expect(request.body).toEqual(credentials);
      expect(tokens.saved).toEqual(newTokens);
    },
  );

  it("sends the access token as a Bearer header", async () => {
    const { api, fetch } = setup({ "GET /users/me": [jsonResponse(200, me)] });

    await api.users.me();

    expect(sentRequest(fetch, 0).headers.get("Authorization")).toBe("Bearer access-old");
  });

  it("never sends the Authorization header to auth endpoints", async () => {
    const { api, fetch } = setup({
      "POST /auth/login": [jsonResponse(200, { ...newTokens, user: me })],
    });

    await api.auth.login(credentials);

    expect(sentRequest(fetch, 0).headers.has("Authorization")).toBe(false);
  });

  it("refreshes once on 401 and retries the original request with the new token", async () => {
    const { api, fetch, tokens } = setup({
      "GET /users/me": [jsonResponse(401), jsonResponse(200, me)],
      "POST /auth/refresh": [jsonResponse(200, newTokens)],
    });

    await expect(api.users.me()).resolves.toEqual(me);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sentRequest(fetch, 1)).toMatchObject({
      url: `${BASE_URL}/auth/refresh`,
      body: { refreshToken: "refresh-old" },
    });
    expect(sentRequest(fetch, 2).headers.get("Authorization")).toBe("Bearer access-new");
    expect(tokens.saved).toEqual(newTokens);
  });

  it("shares one refresh between concurrent 401 responses", async () => {
    const { api, fetch } = setup({
      "GET /users/me": (init) =>
        new Headers(init.headers).get("Authorization") === "Bearer access-new"
          ? jsonResponse(200, me)
          : jsonResponse(401),
      "POST /auth/refresh": [jsonResponse(200, newTokens)],
    });

    await expect(Promise.all([api.users.me(), api.users.me(), api.users.me()])).resolves.toEqual([
      me,
      me,
      me,
    ]);

    const refreshes = fetch.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"));
    expect(refreshes).toHaveLength(1);
  });

  it("retries without refreshing when another request already refreshed the session", async () => {
    const tokens = memoryTokenStore();
    let calls = 0;
    const { api, fetch } = setup(
      {
        "GET /users/me": () => {
          calls += 1;
          if (calls > 1) return jsonResponse(200, me);
          tokens.saved = newTokens; // another request rotated the tokens meanwhile
          return jsonResponse(401);
        },
      },
      tokens,
    );

    await expect(api.users.me()).resolves.toEqual(me);

    expect(fetch.mock.calls.some(([url]) => url.endsWith("/auth/refresh"))).toBe(false);
    expect(sentRequest(fetch, 1).headers.get("Authorization")).toBe("Bearer access-new");
  });

  it("clears the session and calls onSessionExpired when the refresh is rejected", async () => {
    const { api, tokens, onSessionExpired } = setup({
      "GET /users/me": [jsonResponse(401)],
      "POST /auth/refresh": [jsonResponse(401, { statusCode: 401, message: "Unauthorized" })],
    });

    const error = await api.users.me().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "http", status: 401 });
    expect(tokens.saved).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it.each([429, 500])(
    "keeps the session when the refresh fails with %i instead of 401",
    async (status) => {
      const { api, tokens, onSessionExpired } = setup({
        "GET /users/me": [jsonResponse(401)],
        "POST /auth/refresh": [jsonResponse(status)],
      });

      await expect(api.users.me()).rejects.toMatchObject({ kind: "http", status });

      expect(tokens.saved).toEqual(oldTokens);
      expect(onSessionExpired).not.toHaveBeenCalled();
    },
  );

  it("gives up after one retry instead of refreshing in a loop", async () => {
    const { api, fetch, onSessionExpired } = setup({
      "GET /users/me": [jsonResponse(401), jsonResponse(401)],
      "POST /auth/refresh": [jsonResponse(200, newTokens)],
    });

    await expect(api.users.me()).rejects.toMatchObject({ kind: "http", status: 401 });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("never tries to refresh after a failed login", async () => {
    const { api, fetch, onSessionExpired } = setup({
      "POST /auth/login": [
        jsonResponse(401, { statusCode: 401, message: "Nieprawidłowy e-mail lub hasło" }),
      ],
    });

    await expect(api.auth.login(credentials)).rejects.toMatchObject({
      kind: "http",
      status: 401,
      message: "Nieprawidłowy e-mail lub hasło",
    });

    expect(fetch).toHaveBeenCalledOnce();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("does not try to refresh without a refresh token", async () => {
    const { api, fetch } = setup({ "GET /users/me": [jsonResponse(401)] }, memoryTokenStore(null));

    await expect(api.users.me()).rejects.toMatchObject({ status: 401 });

    expect(fetch).toHaveBeenCalledOnce();
    expect(sentRequest(fetch, 0).headers.has("Authorization")).toBe(false);
  });

  it.each([
    [
      "a single message",
      jsonResponse(409, { statusCode: 409, message: "Konto już istnieje", error: "Conflict" }),
      "Konto już istnieje",
    ],
    [
      "a list of messages",
      jsonResponse(400, { statusCode: 400, message: ["Zły e-mail", "Za krótkie hasło"] }),
      "Zły e-mail; Za krótkie hasło",
    ],
    ["no JSON body", new Response("Internal Server Error", { status: 500 }), "HTTP 500"],
  ])("turns an error response with %s into ApiError", async (_case, response, message) => {
    const { api } = setup({ "POST /auth/register": [response] });

    await expect(api.auth.register(credentials)).rejects.toMatchObject({
      kind: "http",
      status: response.status,
      message,
    });
  });

  it.each([
    ["breaks the shared schema", jsonResponse(200, { ...me, plan: "GOLD" })],
    ["is not JSON", new Response("<html>proxy error</html>", { status: 200 })],
  ])("rejects a successful response that %s", async (_case, response) => {
    const { api } = setup({ "GET /users/me": [response] });

    await expect(api.users.me()).rejects.toMatchObject({ kind: "invalid-response", status: 200 });
  });

  it("reports network failures as ApiError of kind 'network'", async () => {
    const { api } = setup({
      "GET /users/me": () => Promise.reject(new TypeError("Network request failed")),
    });

    await expect(api.users.me()).rejects.toMatchObject({ kind: "network", status: null });
  });

  it("deletes the account, resolves the 204 without a body and clears the tokens", async () => {
    const { api, fetch, tokens } = setup({
      "DELETE /users/me": [new Response(null, { status: 204 })],
    });

    await expect(api.users.deleteMe({ password: "tajne-haslo-123" })).resolves.toBeUndefined();

    expect(sentRequest(fetch, 0).body).toEqual({ password: "tajne-haslo-123" });
    expect(tokens.saved).toBeNull();
  });

  it("logs out on the server and clears tokens even if the call fails", async () => {
    const { api, fetch, tokens } = setup({ "POST /auth/logout": [jsonResponse(500)] });

    await expect(api.auth.logout()).resolves.toBeUndefined();

    expect(sentRequest(fetch, 0).body).toEqual({ refreshToken: "refresh-old" });
    expect(tokens.saved).toBeNull();
  });

  it("joins the base URL and path without a double slash", async () => {
    const fetch = fakeFetch({ "GET /users/me": [jsonResponse(200, me)] });
    const api = createApiClient({ baseUrl: `${BASE_URL}/`, tokens: memoryTokenStore(), fetch });

    await api.users.me();

    expect(sentRequest(fetch, 0).url).toBe(`${BASE_URL}/users/me`);
  });

  it("uses the global fetch when none is passed", async () => {
    const globalFetch = vi.fn(() => Promise.resolve(jsonResponse(200, me)));
    vi.stubGlobal("fetch", globalFetch);
    try {
      const api = createApiClient({ baseUrl: BASE_URL, tokens: memoryTokenStore() });
      await expect(api.users.me()).resolves.toEqual(me);
      expect(globalFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
