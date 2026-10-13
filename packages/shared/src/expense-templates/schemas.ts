import { z } from "zod";

import { amountSchema, idSchema } from "../common/schemas.js";

/** Krótko, bo nazwa mieści się na przycisku w szybkim dodawaniu („Kawa”). */
const NAME_MAX = 40;

const templateFieldsSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  amount: amountSchema,
  // Wymagana: szablon zapisuje wydatek jednym tapnięciem, bez pytania o kategorię.
  categoryId: idSchema,
});

/** Body `POST /expense-templates`. */
export const createExpenseTemplateSchema = templateFieldsSchema;

/** Body `PATCH /expense-templates/:id`. */
export const updateExpenseTemplateSchema = templateFieldsSchema.partial();

/**
 * Szablon w odpowiedzi API. `categoryId` jest `null`, gdy kategorię
 * usunięto — appka poprosi wtedy o nową.
 */
export const expenseTemplateSchema = z.object({
  id: idSchema,
  name: z.string(),
  amount: z.number().int(),
  categoryId: idSchema.nullable(),
});

/** Dane nowego szablonu. */
export type CreateExpenseTemplateInput = z.infer<typeof createExpenseTemplateSchema>;
/** Zmiany szablonu. */
export type UpdateExpenseTemplateInput = z.infer<typeof updateExpenseTemplateSchema>;
/** Szablon szybkiego dodawania („Kawa 14 zł”). */
export type ExpenseTemplate = z.infer<typeof expenseTemplateSchema>;
