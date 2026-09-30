import { BadRequestException, HttpStatus } from "@nestjs/common";
import { idSchema } from "@vireo/shared";
import type { Response } from "express";

import type { Prisma } from "../generated/prisma/client.js";
import type { DbTransaction } from "../prisma/prisma.module.js";
import type { IdempotencyService } from "./idempotency.service.js";

/**
 * POST tworzący zasób, z opcjonalnym nagłówkiem `Idempotency-Key` (UUID).
 * Bez nagłówka — zwykły zapis. Z nagłówkiem — zapis i klucz w jednej
 * transakcji bazy; ponowienie z tym samym kluczem dostaje zapisaną
 * odpowiedź i nagłówek `Idempotent-Replayed: true`.
 *
 * `perform` dostaje transakcję (z kluczem) albo `undefined` (bez niego —
 * serwis używa wtedy własnego klienta bazy).
 */
export async function idempotentPost<T extends Prisma.InputJsonObject>(
  idempotency: IdempotencyService,
  options: {
    userId: string;
    /** Endpoint, np. "POST /recurring-rules" — klucz obowiązuje tylko w nim. */
    scope: string;
    rawKey: string | undefined;
    /** Zwalidowane body. */
    request: unknown;
    res: Response;
    perform: (tx?: DbTransaction) => Promise<T>;
  },
): Promise<T> {
  const { userId, scope, rawKey, request, res, perform } = options;
  if (rawKey === undefined) return perform();

  const key = idSchema.safeParse(rawKey);
  if (!key.success) throw new BadRequestException("Idempotency-Key must be a UUID");

  const result = await idempotency.run({
    userId,
    scope,
    key: key.data,
    request,
    status: HttpStatus.CREATED,
    perform,
  });
  if (result.replayed) res.setHeader("Idempotent-Replayed", "true");
  return result.body;
}
