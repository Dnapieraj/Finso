import { z } from "zod";

import {
  amountSchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
} from "../common/schemas.js";

/** Pozycja `GET /confirmations` — termin, o który appka pyta. */
export const dueConfirmationSchema = z.object({
  kind: z.enum(["INCOME", "EXPENSE"]),
  /** Id źródła dochodu (INCOME) albo reguły wydatku (EXPENSE). */
  id: idSchema,
  label: z.string(),
  occurrenceDate: isoDateOutputSchema,
  expectedAmount: z.number().int(),
  /** `false` po „Jeszcze nie” — dziś już nie pytać, ale dalej pokazywać. */
  askToday: z.boolean(),
  /** Termin z poprzedniego okresu, wciąż bez odpowiedzi. */
  overdue: z.boolean(),
});

/** Odpowiedź `GET /confirmations`. */
export const dueConfirmationListSchema = z.array(dueConfirmationSchema);

/**
 * Body `POST /confirmations`:
 * - `CONFIRMED` — wpłynęło / zapłacone; `amount` tylko przy innej kwocie
 *   niż oczekiwana,
 * - `NOT_YET` — „Jeszcze nie”: dalej w budżecie, appka pyta jutro,
 * - `SKIPPED` — „Nie w tym okresie” (tylko płatności): kwota wraca do budżetu.
 *
 * Wpływ wskazuje `incomeSourceId`, płatność `recurringRuleId`. Jeden
 * obiekt z regułami zamiast unii, bo DTO w NestJS musi być klasą.
 */
export const answerConfirmationSchema = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE"]),
    incomeSourceId: idSchema.optional(),
    recurringRuleId: idSchema.optional(),
    occurrenceDate: isoDateInputSchema,
    answer: z.enum(["CONFIRMED", "NOT_YET", "SKIPPED"]),
    amount: amountSchema.optional(),
  })
  .superRefine((body, ctx) => {
    const [needed, unwanted] =
      body.kind === "INCOME"
        ? (["incomeSourceId", "recurringRuleId"] as const)
        : (["recurringRuleId", "incomeSourceId"] as const);
    if (body[needed] === undefined) {
      ctx.addIssue({ code: "custom", path: [needed], message: "Wymagane dla tego rodzaju" });
    }
    if (body[unwanted] !== undefined) {
      ctx.addIssue({ code: "custom", path: [unwanted], message: "Nie dla tego rodzaju" });
    }
    if (body.kind === "INCOME" && body.answer === "SKIPPED") {
      ctx.addIssue({ code: "custom", path: ["answer"], message: "Tylko dla płatności" });
    }
    if (body.amount !== undefined && body.answer !== "CONFIRMED") {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Kwotę podaje się tylko przy potwierdzeniu",
      });
    }
  });

/** Termin do potwierdzenia, jak przychodzi z API. */
export type DueConfirmation = z.infer<typeof dueConfirmationSchema>;
/** Odpowiedź na pytanie o termin — po walidacji. */
export type AnswerConfirmationInput = z.infer<typeof answerConfirmationSchema>;
/** Odpowiedź na pytanie o termin, jak wysyła ją klient (data jako tekst). */
export type AnswerConfirmationRequest = z.input<typeof answerConfirmationSchema>;
