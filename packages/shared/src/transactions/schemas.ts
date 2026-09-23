import { z } from 'zod';

import {
  amountSchema,
  cursorPageQuerySchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
  pageSchema,
} from '../common/schemas.js';

/** Status potwierdzenia — lustro enuma `ConfirmationStatus` z bazy. */
export const confirmationStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'DECLINED']);

// Bez `.default()` — schemat bazowy służy też do PATCH, gdzie domyślna
// wartość nadpisałaby istniejący status przy każdej edycji notatki.
const transactionFieldsSchema = z.object({
  /** Wydatek zawsze dodatni — kierunek przepływu wynika z modelu (Transaction = wydatek). */
  amount: amountSchema,
  date: isoDateInputSchema,
  categoryId: idSchema.nullable().optional(),
  recurringRuleId: idSchema.nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  status: confirmationStatusSchema,
});

/** Body `POST /transactions`. Ręcznie wpisany wydatek jest domyślnie potwierdzony. */
export const createTransactionSchema = transactionFieldsSchema.extend({
  status: confirmationStatusSchema.default('CONFIRMED'),
});

/** Body `PATCH /transactions/:id`. */
export const updateTransactionSchema = transactionFieldsSchema.partial();

/** Query `GET /transactions`. Zakres dat inclusive z obu stron. */
export const listTransactionsQuerySchema = cursorPageQuerySchema.extend({
  from: isoDateInputSchema.optional(),
  to: isoDateInputSchema.optional(),
  categoryId: idSchema.optional(),
});

/** Transakcja w odpowiedzi API. */
export const transactionSchema = z.object({
  id: idSchema,
  amount: z.number().int(),
  date: isoDateOutputSchema,
  categoryId: idSchema.nullable(),
  recurringRuleId: idSchema.nullable(),
  note: z.string().nullable(),
  status: confirmationStatusSchema,
});

/** Strona transakcji. */
export const transactionPageSchema = pageSchema(transactionSchema);

/** Dane nowej transakcji. */
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
/** Zmiany transakcji. */
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
/** Filtry listy transakcji. */
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
/** Transakcja w odpowiedzi API. */
export type TransactionDto = z.infer<typeof transactionSchema>;
/** Strona transakcji. */
export type TransactionPage = z.infer<typeof transactionPageSchema>;
