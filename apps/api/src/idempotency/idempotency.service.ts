import { createHash } from "node:crypto";

import { Inject, Injectable, UnprocessableEntityException } from "@nestjs/common";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { Prisma } from "../generated/prisma/client.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

/**
 * Jak długo działa klucz. Ponowienia po zerwanym połączeniu przychodzą po
 * sekundach lub minutach; 24 h (jak w Stripe) zostawia zapas na telefon,
 * który długo był offline. Zapisane odpowiedzi to dane finansowe, więc po
 * terminie są usuwane (IdempotencySweeper i każdy zapis z kluczem).
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const UNIQUE_VIOLATION = "P2002";

/** Wynik żądania: nowa odpowiedź albo zapisana przy pierwszym wykonaniu. */
export interface IdempotentResult<T> {
  body: T;
  replayed: boolean;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Wykonuje `perform` najwyżej raz dla (użytkownik, scope, klucz) w czasie
   * życia klucza; kolejne żądania dostają zapisaną odpowiedź.
   *
   * `perform` i zapis klucza idą w jednej transakcji bazy: gdy dwa żądania
   * z tym samym kluczem przyjdą naraz, drugie trafia na unikalny indeks,
   * jego transakcja się wycofuje (razem z duplikatem wydatku), a ono samo
   * zwraca odpowiedź pierwszego.
   *
   * @throws {UnprocessableEntityException} gdy klucz użyto z inną treścią.
   */
  async run<T extends Prisma.InputJsonObject>(options: {
    userId: string;
    scope: string;
    key: string;
    /** Zwalidowane body — z niego liczony jest odcisk żądania. */
    request: unknown;
    status: number;
    perform: (tx: DbTransaction) => Promise<T>;
  }): Promise<IdempotentResult<T>> {
    const { userId, scope, key, status, perform } = options;
    const requestHash = hashRequest(options.request);
    const now = this.clock.now();
    await this.purgeExpired();

    const stored = await this.findValid(userId, scope, key, now);
    if (stored) return replay<T>(stored, requestHash);

    try {
      return await this.db.$transaction(async (tx) => {
        const body = await perform(tx);
        await tx.idempotencyKey.create({
          data: {
            userId,
            scope,
            key,
            requestHash,
            responseStatus: status,
            responseBody: body,
            expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
          },
        });
        return { body, replayed: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        // Równoległe żądanie zapisało klucz pierwsze; jego transakcja jest
        // już zatwierdzona, więc tu jej odpowiedź jest widoczna.
        const winner = await this.findValid(userId, scope, key, now);
        if (winner) return replay<T>(winner, requestHash);
      }
      throw error;
    }
  }

  /**
   * Usuwa wygasłe klucze wszystkich użytkowników razem z zapisanymi
   * odpowiedziami. Zwraca liczbę usuniętych wierszy.
   */
  async purgeExpired(): Promise<number> {
    const { count } = await this.db.idempotencyKey.deleteMany({
      where: { expiresAt: { lte: this.clock.now() } },
    });
    return count;
  }

  /** Wygasły klucz traktujemy jak nieistniejący, nawet zanim sprzątanie go usunie. */
  private findValid(userId: string, scope: string, key: string, now: Date) {
    return this.db.idempotencyKey.findFirst({
      where: { userId, scope, key, expiresAt: { gt: now } },
    });
  }
}

function replay<T>(
  stored: { requestHash: string; responseBody: unknown },
  requestHash: string,
): IdempotentResult<T> {
  if (stored.requestHash !== requestHash) {
    throw new UnprocessableEntityException(
      "Idempotency-Key was already used with a different request",
    );
  }
  return { body: stored.responseBody as T, replayed: true };
}

/**
 * Odcisk zwalidowanego body. Zod zwraca pola w kolejności ze schematu,
 * więc ta sama treść daje ten sam tekst niezależnie od kolejności w JSON-ie
 * klienta; domyślne wartości (np. status) są już uzupełnione.
 */
function hashRequest(request: unknown): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
