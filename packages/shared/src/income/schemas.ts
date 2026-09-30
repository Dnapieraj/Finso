import { z } from "zod";

import {
  amountSchema,
  cursorPageQuerySchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
  pageSchema,
} from "../common/schemas.js";
import { scheduleOutputSchema, scheduleSchema } from "../recurring-rules/schemas.js";
import { confirmationStatusSchema } from "../transactions/schemas.js";

/** Rodzaj źródła dochodu — lustro enuma `IncomeSourceKind` z bazy. */
export const incomeSourceKindSchema = z.enum(["REGULAR", "IRREGULAR"]);

const sourceShapeFieldsSchema = z.object({
  kind: incomeSourceKindSchema,
  expectedAmount: amountSchema.nullable(),
});

type SourceShapeFields = z.infer<typeof sourceShapeFieldsSchema>;

/**
 * REGULAR ma stałą, oczekiwaną kwotę. IRREGULAR — nie: jego prognozę
 * liczy silnik z historii wpływów, więc wpisana ręcznie kwota byłaby
 * sprzeczna z tym, co pokazuje budżet.
 */
function checkSourceShape(source: SourceShapeFields, ctx: z.RefinementCtx): void {
  if (source.kind === "REGULAR" && source.expectedAmount === null) {
    ctx.addIssue({ code: "custom", path: ["expectedAmount"], message: "required_for_regular" });
  }
  if (source.kind === "IRREGULAR" && source.expectedAmount !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedAmount"],
      message: "not_allowed_for_irregular",
    });
  }
}

/**
 * `schedule` to harmonogram tworzony razem ze źródłem (w jednej transakcji)
 * — alternatywa dla podpięcia istniejącej reguły przez `recurringRuleId`.
 * Nieregularny dochód nie ma harmonogramu: silnik liczy go z wpływów.
 */
function checkSchedule(
  source: { kind?: string; schedule?: unknown; recurringRuleId?: string | null },
  ctx: z.RefinementCtx,
): void {
  if (source.schedule === undefined || source.schedule === null) return;
  if (source.kind === "IRREGULAR") {
    ctx.addIssue({ code: "custom", path: ["schedule"], message: "not_allowed_for_irregular" });
  }
  if (source.recurringRuleId !== undefined && source.recurringRuleId !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["schedule"],
      message: "conflicts_with_recurring_rule_id",
    });
  }
}

/** Kształt źródła po scaleniu zmian z PATCH ze stanem z bazy. */
export const incomeSourceShapeSchema = sourceShapeFieldsSchema
  .extend({ hasSchedule: z.boolean() })
  .superRefine((source, ctx) => {
    checkSourceShape(source, ctx);
    if (source.kind === "IRREGULAR" && source.hasSchedule) {
      ctx.addIssue({ code: "custom", path: ["schedule"], message: "not_allowed_for_irregular" });
    }
  });

/** Body `POST /income/sources`. */
export const createIncomeSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    kind: incomeSourceKindSchema,
    expectedAmount: amountSchema.nullable().default(null),
    /** Reguła typu INCOME opisująca, kiedy wpływa (np. 10. dnia miesiąca). */
    recurringRuleId: idSchema.nullable().default(null),
    /** Albo harmonogram do utworzenia razem ze źródłem. */
    schedule: scheduleSchema.nullable().default(null),
  })
  .superRefine((source, ctx) => {
    checkSourceShape(source, ctx);
    checkSchedule(source, ctx);
  });

/** Body `PATCH /income/sources/:id`. */
export const updateIncomeSourceSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    kind: incomeSourceKindSchema,
    expectedAmount: amountSchema.nullable(),
    recurringRuleId: idSchema.nullable(),
    /** Archiwizacja (np. zmiana pracy) — historia wpływów zostaje. */
    isActive: z.boolean(),
    /** Nowy harmonogram (zmienia podpiętą regułę albo tworzy ją); `null` odpina i usuwa regułę. */
    schedule: scheduleSchema.nullable(),
  })
  .partial()
  .superRefine(checkSchedule);

/** Źródło dochodu w odpowiedzi API. */
export const incomeSourceSchema = z.object({
  id: idSchema,
  name: z.string(),
  kind: incomeSourceKindSchema,
  expectedAmount: z.number().int().nullable(),
  recurringRuleId: idSchema.nullable(),
  isActive: z.boolean(),
  /** Harmonogram podpiętej reguły — appka pokazuje go bez pobierania reguł. */
  schedule: scheduleOutputSchema.nullable(),
});

const incomeEntryFieldsSchema = z.object({
  incomeSourceId: idSchema,
  amount: amountSchema,
  date: isoDateInputSchema,
  status: confirmationStatusSchema,
});

/**
 * Body `POST /income/entries`. Domyślnie CONFIRMED — wpływ wpisany ręcznie
 * to fakt ("dostałem przelew"). PENDING w bazie jest dla wpływów
 * spodziewanych, które kiedyś zaproponuje system na podstawie reguł.
 */
export const createIncomeEntrySchema = incomeEntryFieldsSchema.extend({
  status: confirmationStatusSchema.default("CONFIRMED"),
});

/** Body `PATCH /income/entries/:id`. Źródła nie da się zmienić — to byłby inny wpływ. */
export const updateIncomeEntrySchema = incomeEntryFieldsSchema
  .omit({ incomeSourceId: true })
  .partial();

/** Query `GET /income/entries`. */
export const listIncomeEntriesQuerySchema = cursorPageQuerySchema.extend({
  from: isoDateInputSchema.optional(),
  to: isoDateInputSchema.optional(),
  incomeSourceId: idSchema.optional(),
});

/** Wpływ w odpowiedzi API. */
export const incomeEntrySchema = z.object({
  id: idSchema,
  incomeSourceId: idSchema,
  amount: z.number().int(),
  date: isoDateOutputSchema,
  status: confirmationStatusSchema,
});

/** Strona wpływów. */
export const incomeEntryPageSchema = pageSchema(incomeEntrySchema);

/** Dane nowego źródła dochodu. */
export type CreateIncomeSourceInput = z.infer<typeof createIncomeSourceSchema>;
/** Nowe źródło, jak wysyła je klient (pola z domyślną wartością są opcjonalne). */
export type CreateIncomeSourceRequest = z.input<typeof createIncomeSourceSchema>;
/** Zmiany źródła dochodu. */
export type UpdateIncomeSourceInput = z.infer<typeof updateIncomeSourceSchema>;
/** Źródło dochodu w odpowiedzi API. */
export type IncomeSource = z.infer<typeof incomeSourceSchema>;
/** Dane nowego wpływu. */
export type CreateIncomeEntryInput = z.infer<typeof createIncomeEntrySchema>;
/** Zmiany wpływu. */
export type UpdateIncomeEntryInput = z.infer<typeof updateIncomeEntrySchema>;
/** Filtry listy wpływów. */
export type ListIncomeEntriesQuery = z.infer<typeof listIncomeEntriesQuerySchema>;
/** Wpływ w odpowiedzi API. */
export type IncomeEntry = z.infer<typeof incomeEntrySchema>;
/** Strona wpływów. */
export type IncomeEntryPage = z.infer<typeof incomeEntryPageSchema>;
