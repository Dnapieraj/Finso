import { z } from "zod";

import { amountSchema, isoDateInputSchema } from "../common/schemas.js";

/** Najwięcej wierszy w jednym imporcie — kilka miesięcy wyciągu z zapasem. */
export const IMPORT_MAX_ROWS = 2_000;

/** Body `POST /transactions/import` — wydatki z wyciągu, już przeczytane przez appkę. */
export const importTransactionsSchema = z.object({
  rows: z
    .array(
      z.object({
        date: isoDateInputSchema,
        amount: amountSchema,
        note: z.string().trim().max(500).nullable(),
      }),
    )
    .min(1)
    .max(IMPORT_MAX_ROWS),
});

/** Odpowiedź importu: zapisane i pominięte, bo już są w Finso (ta sama data i kwota). */
export const importResultSchema = z.object({
  imported: z.number().int(),
  duplicates: z.number().int(),
});

/** Wydatki z wyciągu do zapisania. */
export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
/** Wynik importu. */
export type ImportResult = z.infer<typeof importResultSchema>;
