import { z } from "zod";

import { amountSchema, idSchema } from "../common/schemas.js";

/** Body `PUT /category-limits/:categoryId` — limit na okres budżetowy. */
export const setCategoryLimitSchema = z.object({ amount: amountSchema });

const amountOutput = z.number().int();

/** Stan limitu w bieżącym okresie — patrz categoryLimitStatuses. */
export const categoryLimitStatusSchema = z.object({
  categoryId: idSchema,
  limit: amountOutput,
  spent: amountOutput,
  left: amountOutput,
  perDayLeft: amountOutput,
  state: z.enum(["ok", "near", "over"]),
});

/** „Chudy” okres i podpowiedzi — patrz leanMonth. */
export const leanMonthSchema = z.object({
  counted: amountOutput,
  typical: amountOutput,
  shortfall: amountOutput,
  suggestions: z.array(
    z.object({ categoryId: idSchema, usual: amountOutput, suggested: amountOutput }),
  ),
});

/** Odpowiedź `GET /category-limits`. */
export const categoryLimitsOverviewSchema = z.object({
  limits: z.array(categoryLimitStatusSchema),
  leanMonth: leanMonthSchema.nullable(),
});

/** Nowy albo zmieniony limit kategorii. */
export type SetCategoryLimitInput = z.infer<typeof setCategoryLimitSchema>;
/** Limity w bieżącym okresie i podpowiedzi „chudego miesiąca”. */
export type CategoryLimitsOverview = z.infer<typeof categoryLimitsOverviewSchema>;
