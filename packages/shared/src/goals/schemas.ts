import { z } from "zod";

import {
  amountSchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
  nonNegativeAmountSchema,
} from "../common/schemas.js";

// Termin w przeszłości jest dozwolony — silnik budżetu obsługuje cel
// "po terminie" (calculateGoalContribution → isOverdue), a użytkownik
// może chcieć zapisać cel, którego nie zdążył domknąć.
const goalFieldsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: amountSchema,
  currentAmount: nonNegativeAmountSchema,
  targetDate: isoDateInputSchema,
});

/** Body `POST /goals`. */
export const createGoalSchema = goalFieldsSchema.extend({
  currentAmount: nonNegativeAmountSchema.default(0),
});

/** Body `PATCH /goals/:id`. */
export const updateGoalSchema = goalFieldsSchema.partial();

/**
 * Body `POST /goals/:id/deposits`. Bez daty = dziś (w strefie użytkownika);
 * data z przyszłości jest odrzucana przez API.
 */
export const createGoalDepositSchema = z.object({
  amount: amountSchema,
  date: isoDateInputSchema.optional(),
});

/** Wpłata na cel w odpowiedzi API. */
export const goalDepositSchema = z.object({
  id: idSchema,
  goalId: idSchema,
  amount: z.number().int(),
  date: isoDateOutputSchema,
});

/** Cel w odpowiedzi API. */
export const goalSchema = z.object({
  id: idSchema,
  name: z.string(),
  targetAmount: z.number().int(),
  currentAmount: z.number().int(),
  targetDate: isoDateOutputSchema,
});

/** Dane nowego celu. */
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
/** Nowy cel, jak wysyła go klient (`currentAmount` opcjonalne). */
export type CreateGoalRequest = z.input<typeof createGoalSchema>;
/** Zmiany celu. */
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
/** Cel w odpowiedzi API. `currentAmount` = odłożone razem, z wpłatami. */
export type Goal = z.infer<typeof goalSchema>;
/** Dane nowej wpłaty. */
export type CreateGoalDepositInput = z.infer<typeof createGoalDepositSchema>;
/** Nowa wpłata, jak wysyła ją klient — z celem, na który idzie. */
export type CreateGoalDepositRequest = z.input<typeof createGoalDepositSchema> & { goalId: string };
/** Wpłata na cel w odpowiedzi API. */
export type GoalDeposit = z.infer<typeof goalDepositSchema>;
