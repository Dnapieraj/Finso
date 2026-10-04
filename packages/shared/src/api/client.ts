import { z } from "zod";

import {
  authSessionSchema,
  authTokensSchema,
  type AuthTokens,
  type DeleteAccountInput,
  type LoginInput,
  type RegisterInput,
} from "../auth/schemas.js";
import {
  budgetSummarySchema,
  simulationResultSchema,
  type BudgetSummary,
  type SimulatePurchaseRequest,
  type SimulationResult,
} from "../budget/schemas.js";
import { categorySchema, type Category } from "../categories/schemas.js";
import {
  dueConfirmationListSchema,
  type AnswerConfirmationRequest,
  type DueConfirmation,
} from "../confirmations/schemas.js";
import type { IdempotentDraft } from "../common/schemas.js";
import {
  goalSchema,
  type CreateGoalRequest,
  type Goal,
  type UpdateGoalInput,
} from "../goals/schemas.js";
import {
  incomeSourceSchema,
  type CreateIncomeSourceRequest,
  type IncomeSource,
  type UpdateIncomeSourceInput,
} from "../income/schemas.js";
import type { CompleteOnboardingRequest } from "../onboarding/schemas.js";
import {
  transactionPageSchema,
  transactionSchema,
  transactionSummarySchema,
  type CreateTransactionRequest,
  type TransactionDraft,
  type ListTransactionsQuery,
  type Transaction,
  type TransactionPage,
  type TransactionSummary,
  type TransactionSummaryQuery,
  type UpdateTransactionInput,
} from "../transactions/schemas.js";
import {
  recurringRuleSchema,
  type CreateRecurringRuleRequest,
  type RecurringRule,
  type UpdateRecurringRuleInput,
} from "../recurring-rules/schemas.js";
import { publicUserSchema, type PublicUser, type UpdateMeInput } from "../users/schemas.js";

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
  /**
   * Generator UUID dla kluczy idempotencji. Domyślnie `crypto.randomUUID`;
   * Hermes (React Native) go nie ma, więc mobile podaje `expo-crypto`.
   */
  readonly randomUUID?: () => string;
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
    /** Ustawienia budżetu: dzień wypłaty, strefa czasowa. */
    updateMe(input: UpdateMeInput): Promise<PublicUser>;
    /** Usuwa konto (kaskadowo, wymaga hasła) i czyści tokeny. */
    deleteMe(input: DeleteAccountInput): Promise<void>;
    /**
     * Zapisuje odpowiedzi z onboardingu naraz i zwraca użytkownika z
     * `onboardingCompleted: true`. 409 = onboarding był już ukończony.
     */
    completeOnboarding(input: CompleteOnboardingRequest): Promise<PublicUser>;
  };
  readonly budget: {
    /** Ile zostało do końca bieżącego okresu i ile dziennie. */
    current(): Promise<BudgetSummary>;
    /** „Czy stać mnie na to teraz” — nic nie zapisuje. */
    simulate(input: SimulatePurchaseRequest): Promise<SimulationResult>;
  };
  readonly confirmations: {
    /** Wpływy i stałe płatności czekające na odpowiedź — bieżące i zaległe. */
    list(): Promise<DueConfirmation[]>;
    /**
     * Odpowiedź na pytanie o termin. Po niej trzeba odświeżyć budżet —
     * potwierdzenie albo „Nie w tym okresie” zmienia „Możesz wydać”.
     */
    answer(input: AnswerConfirmationRequest): Promise<void>;
  };
  readonly goals: {
    /** Cele posortowane po terminie, najbliższy pierwszy (bez tych w koszu). */
    list(): Promise<Goal[]>;
    /** Cel z własnym kluczem idempotencji — jeden draft na jeden cel. */
    draft(input: CreateGoalRequest): IdempotentDraft<CreateGoalRequest>;
    /** Ponowne wysłanie tego samego draftu zwraca zapisany wcześniej cel. */
    create(draft: IdempotentDraft<CreateGoalRequest>): Promise<Goal>;
    /** Zmienia tylko podane pola. */
    update(id: string, input: UpdateGoalInput): Promise<Goal>;
    /** Przenosi cel do kosza (miękkie usunięcie, da się przywrócić). */
    remove(id: string): Promise<void>;
    /** Wyjmuje cel z kosza. */
    restore(id: string): Promise<Goal>;
  };
  readonly recurringRules: {
    /** Reguły wydatków i dochodów, także wyłączone. */
    list(): Promise<RecurringRule[]>;
    /** Reguła z własnym kluczem idempotencji — jeden draft na jedną regułę. */
    draft(input: CreateRecurringRuleRequest): IdempotentDraft<CreateRecurringRuleRequest>;
    /** Ponowne wysłanie tego samego draftu zwraca zapisaną wcześniej regułę. */
    create(draft: IdempotentDraft<CreateRecurringRuleRequest>): Promise<RecurringRule>;
    /** Zmienia tylko podane pola. */
    update(id: string, input: UpdateRecurringRuleInput): Promise<RecurringRule>;
    /** Usuwa regułę; wydatki, które z niej powstały, zostają. */
    remove(id: string): Promise<void>;
  };
  readonly incomeSources: {
    /** Źródła z harmonogramem, także zarchiwizowane. */
    list(): Promise<IncomeSource[]>;
    /** Źródło z własnym kluczem idempotencji — jeden draft na jedno źródło. */
    draft(input: CreateIncomeSourceRequest): IdempotentDraft<CreateIncomeSourceRequest>;
    /**
     * Tworzy źródło, z `schedule` — razem z regułą, w jednej transakcji.
     * Ponowne wysłanie tego samego draftu zwraca zapisane wcześniej źródło.
     */
    create(draft: IdempotentDraft<CreateIncomeSourceRequest>): Promise<IncomeSource>;
    update(id: string, input: UpdateIncomeSourceInput): Promise<IncomeSource>;
    /** 409, gdy źródło ma wpływy — wtedy archiwizuje się je przez `isActive: false`. */
    remove(id: string): Promise<void>;
  };
  readonly categories: {
    /** Kategorie systemowe i własne użytkownika. */
    list(): Promise<Category[]>;
  };
  readonly transactions: {
    /** Strona wydatków od najnowszych; pominięte filtry nie trafiają do URL-a. */
    list(query?: Partial<ListTransactionsQuery>): Promise<TransactionPage>;
    /** Wydatek z własnym kluczem idempotencji — jeden draft na jeden wydatek. */
    draft(input: CreateTransactionRequest): TransactionDraft;
    /**
     * Zapisuje wydatek z nagłówkiem `Idempotency-Key`; ponowne wysłanie tego
     * samego draftu zwraca zapisany wcześniej wydatek zamiast drugiego.
     */
    create(draft: TransactionDraft): Promise<Transaction>;
    /** Przenosi wydatek do kosza (miękkie usunięcie, da się przywrócić). */
    remove(id: string): Promise<void>;
    /** Wyjmuje wydatek z kosza. */
    restore(id: string): Promise<Transaction>;
    /** Jeden wydatek (404, gdy nie ma go albo jest w koszu). */
    get(id: string): Promise<Transaction>;
    /** Zmienia tylko podane pola. */
    update(id: string, input: UpdateTransactionInput): Promise<Transaction>;
    /** Suma i liczba potwierdzonych wydatków okresu wg kategorii. */
    summary(query: TransactionSummaryQuery): Promise<TransactionSummary>;
  };
}

interface Request {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
  /** Dodatkowe nagłówki, np. `Idempotency-Key` — te same przy ponowieniu po 401. */
  readonly headers?: Readonly<Record<string, string>>;
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
  randomUUID = () => globalThis.crypto.randomUUID(),
}: ApiClientOptions): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");
  let refreshing: Promise<boolean> | null = null;

  async function send(request: Request, accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { ...request.headers, Accept: "application/json" };
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

  /** POST/PATCH z body i walidacją odpowiedzi wspólnym schematem. */
  async function write<T>(
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    return parse(await execute({ method, path, body }), schema);
  }

  /** POST z nagłówkiem `Idempotency-Key` z draftu — ten sam przy ponowieniu po 401. */
  async function createKeyed<T>(
    path: string,
    { input, idempotencyKey }: IdempotentDraft<unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    return parse(
      await execute({
        method: "POST",
        path,
        body: input,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
      schema,
    );
  }

  /** GET z walidacją odpowiedzi wspólnym schematem. */
  async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return parse(await execute({ method: "GET", path }), schema);
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
      updateMe: (input) => write("PATCH", "/users/me", input, publicUserSchema),
      async deleteMe(input) {
        await execute({ method: "DELETE", path: "/users/me", body: input });
        await tokens.clear();
      },
      completeOnboarding: async (input) =>
        parse(
          await execute({ method: "POST", path: "/users/me/onboarding", body: input }),
          publicUserSchema,
        ),
    },
    budget: {
      current: () => read("/budget/current", budgetSummarySchema),
      simulate: async (input) =>
        parse(
          await execute({ method: "POST", path: "/budget/simulate", body: input }),
          simulationResultSchema,
        ),
    },
    confirmations: {
      list: () => read("/confirmations", dueConfirmationListSchema),
      async answer(input) {
        await execute({ method: "POST", path: "/confirmations", body: input });
      },
    },
    goals: {
      list: () => read("/goals", z.array(goalSchema)),
      draft: (input) => ({ input, idempotencyKey: randomUUID() }),
      create: (draft) => createKeyed("/goals", draft, goalSchema),
      update: (id, input) => write("PATCH", `/goals/${encodeURIComponent(id)}`, input, goalSchema),
      async remove(id) {
        await execute({ method: "DELETE", path: `/goals/${encodeURIComponent(id)}` });
      },
      restore: (id) =>
        write("POST", `/goals/${encodeURIComponent(id)}/restore`, undefined, goalSchema),
    },
    categories: {
      list: () => read("/categories", z.array(categorySchema)),
    },
    recurringRules: {
      list: () => read("/recurring-rules", z.array(recurringRuleSchema)),
      draft: (input) => ({ input, idempotencyKey: randomUUID() }),
      create: (draft) => createKeyed("/recurring-rules", draft, recurringRuleSchema),
      update: (id, input) =>
        write("PATCH", `/recurring-rules/${encodeURIComponent(id)}`, input, recurringRuleSchema),
      async remove(id) {
        await execute({ method: "DELETE", path: `/recurring-rules/${encodeURIComponent(id)}` });
      },
    },
    incomeSources: {
      list: () => read("/income/sources", z.array(incomeSourceSchema)),
      draft: (input) => ({ input, idempotencyKey: randomUUID() }),
      create: (draft) => createKeyed("/income/sources", draft, incomeSourceSchema),
      update: (id, input) =>
        write("PATCH", `/income/sources/${encodeURIComponent(id)}`, input, incomeSourceSchema),
      async remove(id) {
        await execute({ method: "DELETE", path: `/income/sources/${encodeURIComponent(id)}` });
      },
    },
    transactions: {
      list: (query = {}) => read(`/transactions${queryString(query)}`, transactionPageSchema),
      draft: (input) => ({ input, idempotencyKey: randomUUID() }),
      create: (draft) => createKeyed("/transactions", draft, transactionSchema),
      async remove(id) {
        await execute({ method: "DELETE", path: `/transactions/${encodeURIComponent(id)}` });
      },
      restore: (id) =>
        write(
          "POST",
          `/transactions/${encodeURIComponent(id)}/restore`,
          undefined,
          transactionSchema,
        ),
      get: (id) => read(`/transactions/${encodeURIComponent(id)}`, transactionSchema),
      update: (id, input) =>
        write("PATCH", `/transactions/${encodeURIComponent(id)}`, input, transactionSchema),
      summary: (query) =>
        read(`/transactions/summary${queryString(query)}`, transactionSummarySchema),
    },
  };
}

/** `?a=1&b=2` z pól, które mają wartość; pusty tekst, gdy nie ma żadnego. */
function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
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
