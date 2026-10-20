import { z } from "zod";

import { categorySchema } from "../categories/schemas.js";
import { isoDateOutputSchema } from "../common/schemas.js";
import { goalSchema } from "../goals/schemas.js";
import { incomeEntrySchema, incomeSourceSchema } from "../income/schemas.js";
import { recurringRuleSchema } from "../recurring-rules/schemas.js";
import { transactionSchema } from "../transactions/schemas.js";

/** Termin stałej płatności albo wpływu, na który odpowiada zapis (`null` = ręczny). */
const occurrenceField = { occurrenceDate: isoDateOutputSchema.nullable() };

/**
 * Odpowiedź `GET /export` — wszystkie dane, które użytkownik wpisał (bez
 * kosza), naraz i bez stronicowania. Appka robi z nich pliki CSV.
 */
export const exportDataSchema = z.object({
  /** Dzień eksportu w strefie użytkownika — do nazwy pliku. */
  exportedOn: isoDateOutputSchema,
  categories: z.array(categorySchema),
  expenses: z.array(transactionSchema.extend(occurrenceField)),
  incomeSources: z.array(incomeSourceSchema),
  incomeEntries: z.array(incomeEntrySchema.extend(occurrenceField)),
  goals: z.array(goalSchema),
  recurringRules: z.array(recurringRuleSchema),
});

/** Dane do eksportu. */
export type ExportData = z.infer<typeof exportDataSchema>;
