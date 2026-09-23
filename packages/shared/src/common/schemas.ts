import { z } from 'zod';

import { isoDate } from '../date.js';

/**
 * Górna granica kwoty w jednym wierszu. Kolumny `Int` w Postgresie to
 * int4 — większa liczba skończyłaby się błędem bazy (500) zamiast 400.
 * 2 147 483 647 gr ≈ 21,4 mln zł na jedną transakcję czy cel.
 */
export const INT4_MAX = 2_147_483_647;

/** Identyfikator zasobu (UUID v7 generowany przez bazę). */
export const idSchema = z.uuid();

/**
 * Data kalendarzowa "YYYY-MM-DD" z wejścia, zamieniona na {@link IsoDate}.
 * Zod sprawdza realność daty (29.02 tylko w latach przestępnych).
 */
export const isoDateInputSchema = z.iso.date().transform((value) => isoDate(value));

/** Data kalendarzowa w odpowiedzi API. */
export const isoDateOutputSchema = z.iso.date();

/** Kwota w groszach: dodatnia liczba całkowita mieszcząca się w int4. */
export const amountSchema = z.number().int().positive().max(INT4_MAX);

/** Kwota, która może być zerem (np. dotychczas odłożone na cel). */
export const nonNegativeAmountSchema = z.number().int().min(0).max(INT4_MAX);

/**
 * Parametry stronicowania kursorem. Kursor (id ostatniego elementu),
 * a nie `offset`: nowy wydatek dodany w trakcie przewijania nie
 * przesuwa strony i nie pokazuje dwa razy tej samej pozycji.
 */
export const cursorPageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: idSchema.optional(),
});

/** Strona wyników: elementy + kursor następnej strony (`null` = koniec). */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: idSchema.nullable() });
}
