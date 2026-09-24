import { z } from "zod";

import {
  authSessionSchema,
  authTokensSchema,
  type AuthTokens,
  type DeleteAccountInput,
  type LoginInput,
  type RegisterInput,
} from "../auth/schemas.js";
import { publicUserSchema, type PublicUser } from "../users/schemas.js";

/**
 * Miejsce przechowywania tokenów sesji. Klient nie wie, gdzie leżą —
 * mobile podaje implementację na `expo-secure-store`, testy trzymają je
 * w pamięci.
 */
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

/** Podzbiór `fetch`, którego używa klient — zawsze z URL-em jako tekstem. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Konfiguracja {@link createApiClient}. */
export interface ApiClientOptions {
  /** Adres API, np. `http://192.168.0.106:3000` (końcowy `/` jest dozwolony). */
  readonly baseUrl: string;
  readonly tokens: TokenStore;
  /** Domyślnie globalny `fetch` (jest w React Native i w Node). */
  readonly fetch?: FetchLike;
  /** Wywoływane raz, gdy odświeżenie sesji zostało odrzucone i tokeny wyczyszczone. */
  readonly onSessionExpired?: () => void;
}

/**
 * - `http` — serwer odpowiedział błędem (`status` to kod HTTP),
 * - `network` — brak odpowiedzi (offline, zły adres API; `status` = `null`),
 * - `invalid-response` — odpowiedź 2xx niezgodna ze wspólnym schematem
 *   (rozjazd wersji API i aplikacji).
 */
export type ApiErrorKind = "http" | "network" | "invalid-response";

/**
 * Każdy błąd klienta. Aplikacja dobiera komunikat dla użytkownika po
 * `kind` i `status`; `message` to tekst techniczny albo komunikat z API.
 */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly kind: ApiErrorKind,
    readonly status: number | null,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Metody klienta — po jednej na endpoint API. */
export interface ApiClient {
  readonly auth: {
    /** Zakłada konto, zapisuje tokeny i zwraca użytkownika. */
    register(input: RegisterInput): Promise<PublicUser>;
    /** Loguje, zapisuje tokeny i zwraca użytkownika. */
    login(input: LoginInput): Promise<PublicUser>;
    /** Unieważnia sesję na serwerze i zawsze czyści tokeny lokalnie. */
    logout(): Promise<void>;
  };
  readonly users: {
    me(): Promise<PublicUser>;
    /** Usuwa konto (kaskadowo, wymaga hasła) i czyści tokeny. */
    deleteMe(input: DeleteAccountInput): Promise<void>;
  };
}

interface Request {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  /** Endpointy `/auth/*`: bez tokena i bez odświeżania sesji przy 401. */
  readonly isPublic?: boolean;
}

/** Kształt błędu z NestJS: `message` to tekst albo lista tekstów walidacji. */
const errorBodySchema = z.object({ message: z.union([z.string(), z.array(z.string())]) });

/**
 * Klient API Finso. Typy żądań i odpowiedzi pochodzą ze schematów Zod
 * współdzielonych z API, a każda odpowiedź 2xx jest nimi walidowana.
 *
 * Na 401 klient raz odświeża sesję refresh tokenem i ponawia żądanie.
 * Równoległe żądania czekają na to samo odświeżenie, bo API rotuje refresh
 * tokeny i drugi refresh starym tokenem zostałby uznany za kradzież sesji.
 */
export function createApiClient({
  baseUrl,
  tokens,
  fetch = (url, init) => globalThis.fetch(url, init),
  onSessionExpired,
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");
  let refreshing: Promise<boolean> | null = null;

  async function send(request: Request, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (request.body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    try {
      return await fetch(`${root}${request.path}`, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      });
    } catch (cause) {
      throw new ApiError("network", null, "Network request failed", { cause });
    }
  }

  /** `true`, gdy zapisano nowe tokeny; `false`, gdy nie było czym odświeżyć. */
  function refreshSession(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const refreshToken = await tokens.getRefreshToken();
        if (!refreshToken) return false;
        const response = await send(
          { method: "POST", path: "/auth/refresh", body: { refreshToken } },
          null,
        );
        if (response.status === 401) {
          // Refresh token odrzucony (wygasł, unieważniony): sesji nie da się uratować.
          await tokens.clear();
          onSessionExpired?.();
        }
        // 429 (limit na /auth/*) albo 5xx to chwilowy problem — sesja zostaje.
        if (!response.ok) throw await httpError(response);
        await tokens.setTokens(await parse(response, authTokensSchema));
        return true;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  /**
   * Po 401: ponawia żądanie raz, z nowym tokenem. `null`, gdy nie ma czym
   * odświeżyć sesji (brak refresh tokena) — wtedy zostaje pierwotne 401.
   */
  async function retryWithFreshToken(
    request: Request,
    usedToken: string | null,
  ): Promise<Response | null> {
    const current = await tokens.getAccessToken();
    // Inne żądanie mogło już odświeżyć sesję, gdy to czekało na odpowiedź.
    const refreshed = current !== null && current !== usedToken ? true : await refreshSession();
    return refreshed ? send(request, await tokens.getAccessToken()) : null;
  }

  /** Wysyła żądanie z tokenem; zwraca odpowiedź 2xx albo rzuca {@link ApiError}. */
  async function execute(request: Request): Promise<Response> {
    const usedToken = request.isPublic ? null : await tokens.getAccessToken();
    let response = await send(request, usedToken);

    if (response.status === 401 && !request.isPublic) {
      response = (await retryWithFreshToken(request, usedToken)) ?? response;
    }

    if (!response.ok) throw await httpError(response);
    return response;
  }

  async function startSession(path: string, input: unknown): Promise<PublicUser> {
    const response = await execute({ method: "POST", path, body: input, isPublic: true });
    const { user, ...session } = await parse(response, authSessionSchema);
    await tokens.setTokens(session);
    return user;
  }

  return {
    auth: {
      register: (input) => startSession("/auth/register", input),
      login: (input) => startSession("/auth/login", input),
      async logout() {
        try {
          await execute({
            method: "POST",
            path: "/auth/logout",
            body: { refreshToken: await tokens.getRefreshToken() },
            isPublic: true,
          });
        } catch {
          // Lokalnie sesja kończy się zawsze; refresh token na serwerze i tak wygaśnie.
        } finally {
          await tokens.clear();
        }
      },
    },
    users: {
      me: async () => parse(await execute({ method: "GET", path: "/users/me" }), publicUserSchema),
      async deleteMe(input) {
        await execute({ method: "DELETE", path: "/users/me", body: input });
        await tokens.clear();
      },
    },
  };
}

/** Parsuje JSON odpowiedzi 2xx i sprawdza go wspólnym schematem. */
async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (cause) {
    throw new ApiError("invalid-response", response.status, "Response is not JSON", { cause });
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError("invalid-response", response.status, "Response does not match the schema", {
      cause: result.error,
    });
  }
  return result.data;
}

/** Zamienia odpowiedź błędu na {@link ApiError} z komunikatem z API, jeśli jest. */
async function httpError(response: Response): Promise<ApiError> {
  const body = errorBodySchema.safeParse(await response.json().catch(() => null));
  const message = body.success
    ? [body.data.message].flat().join("; ")
    : `HTTP ${String(response.status)}`;
  return new ApiError("http", response.status, message);
}
