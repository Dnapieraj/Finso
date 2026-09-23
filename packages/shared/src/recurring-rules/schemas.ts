import { z } from "zod";

import {
  amountSchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
} from "../common/schemas.js";

/** Czy reguła opisuje dochód czy wydatek — lustro enuma z bazy. */
export const recurringRuleKindSchema = z.enum(["INCOME", "EXPENSE"]);
/** Jednostka cyklu — lustro enuma z bazy. */
export const recurrenceFrequencySchema = z.enum(["WEEKLY", "MONTHLY", "YEARLY"]);

/**
 * Pola, od których zależy spójność reguły. Osobny schemat, bo przy PATCH
 * klient wysyła tylko część pól — API scala je ze stanem z bazy i
 * sprawdza ten kształt na wyniku (patrz {@link recurringRuleShapeSchema}).
 */
const shapeFieldsSchema = z.object({
  kind: recurringRuleKindSchema,
  name: z.string().nullable(),
  frequency: recurrenceFrequencySchema,
  dayOfMonth: z.number().int().min(1).max(31).nullable(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  expectedAmount: amountSchema.nullable(),
  categoryId: idSchema.nullable(),
});

type ShapeFields = z.infer<typeof shapeFieldsSchema>;

/**
 * Reguły spójności:
 * - WEEKLY → wymaga `dayOfWeek`, bez `dayOfMonth`
 * - MONTHLY/YEARLY → wymaga `dayOfMonth`, bez `dayOfWeek`
 *   (miesiąc dla YEARLY bierze się ze `startDate`)
 * - EXPENSE → wymaga `expectedAmount` (bez kwoty nie ma czego odjąć z budżetu)
 *   i `name` (reguła wydatku JEST zobowiązaniem — pokazujemy ją na liście
 *   i w breakdownie budżetu). Reguła INCOME nazwy nie potrzebuje: to tylko
 *   harmonogram, a nazwę ma podpięte pod nią źródło dochodu.
 * - INCOME → bez `categoryId` (kategorie opisują wydatki)
 *
 * Komunikaty to stabilne klucze, nie zdania — tłumaczy je klient.
 */
function checkShape(rule: ShapeFields, ctx: z.RefinementCtx): void {
  const issue = (path: keyof ShapeFields, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (rule.frequency === "WEEKLY") {
    if (rule.dayOfWeek === null) issue("dayOfWeek", "required_for_weekly");
    if (rule.dayOfMonth !== null) issue("dayOfMonth", "not_allowed_for_weekly");
  } else {
    if (rule.dayOfMonth === null) issue("dayOfMonth", "required_for_monthly_and_yearly");
    if (rule.dayOfWeek !== null) issue("dayOfWeek", "not_allowed_for_monthly_and_yearly");
  }
  if (rule.kind === "EXPENSE" && rule.expectedAmount === null) {
    issue("expectedAmount", "required_for_expense");
  }
  if (rule.kind === "EXPENSE" && rule.name === null) {
    issue("name", "required_for_expense");
  }
  if (rule.kind === "INCOME" && rule.categoryId !== null) {
    issue("categoryId", "not_allowed_for_income");
  }
}

/** Kształt reguły po scaleniu zmian z PATCH ze stanem z bazy. */
export const recurringRuleShapeSchema = shapeFieldsSchema.superRefine(checkShape);

/** Body `POST /recurring-rules`. */
export const createRecurringRuleSchema = z
  .object({
    kind: recurringRuleKindSchema,
    name: z.string().trim().min(1).max(100).nullable().default(null),
    frequency: recurrenceFrequencySchema,
    /** Co ile jednostek `frequency` — 2 przy WEEKLY = co dwa tygodnie. */
    interval: z.number().int().min(1).max(52).default(1),
    /** Początek cyklu. Pierwsze wystąpienie to pierwszy pasujący dzień od tej daty. */
    startDate: isoDateInputSchema,
    dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
    dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
    expectedAmount: amountSchema.nullable().default(null),
    categoryId: idSchema.nullable().default(null),
  })
  .superRefine(checkShape);

/**
 * Body `PATCH /recurring-rules/:id`. Bez `kind` — reguła dochodu może być
 * podpięta pod źródło dochodu, a zmiana na wydatek zerwałaby ten sens.
 */
export const updateRecurringRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(100).nullable(),
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).max(52),
    startDate: isoDateInputSchema,
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    dayOfWeek: z.number().int().min(0).max(6).nullable(),
    expectedAmount: amountSchema.nullable(),
    categoryId: idSchema.nullable(),
    /** Wyłączenie (np. anulowana subskrypcja) zamiast usunięcia — historia zostaje. */
    isActive: z.boolean(),
  })
  .partial();

/** Reguła w odpowiedzi API. */
export const recurringRuleSchema = z.object({
  id: idSchema,
  kind: recurringRuleKindSchema,
  name: z.string().nullable(),
  frequency: recurrenceFrequencySchema,
  interval: z.number().int(),
  startDate: isoDateOutputSchema,
  dayOfMonth: z.number().int().nullable(),
  dayOfWeek: z.number().int().nullable(),
  expectedAmount: z.number().int().nullable(),
  categoryId: idSchema.nullable(),
  isActive: z.boolean(),
});

/** Dane nowej reguły. */
export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
/** Zmiany reguły. */
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
/** Reguła w odpowiedzi API. */
export type RecurringRule = z.infer<typeof recurringRuleSchema>;
