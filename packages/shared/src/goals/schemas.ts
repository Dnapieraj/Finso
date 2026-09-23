import { z } from 'zod';

import {
  amountSchema,
  idSchema,
  isoDateInputSchema,
  isoDateOutputSchema,
  nonNegativeAmountSchema,
} from '../common/schemas.js';

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
/** Zmiany celu. */
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
/** Cel w odpowiedzi API. */
export type Goal = z.infer<typeof goalSchema>;
