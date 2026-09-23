import { z } from "zod";

import { amountSchema, idSchema, isoDateOutputSchema } from "../common/schemas.js";

const amountOutput = z.number().int();

/** Odpowiedź `GET /budget/current` — "ile mogę wydać do końca okresu". */
export const budgetSummarySchema = z.object({
  period: z.object({ start: isoDateOutputSchema, end: isoDateOutputSchema }),
  /** "Dziś" w strefie użytkownika — od tego dnia liczone jest daysRemaining. */
  asOf: isoDateOutputSchema,
  /** Może być ujemne — wtedy użytkownik już jest "pod kreską". */
  availableBalance: amountOutput,
  daysRemaining: z.number().int(),
  dailyAllowance: amountOutput,
  breakdown: z.object({
    periodIncome: amountOutput,
    fixedCommitments: amountOutput,
    goalContributions: amountOutput,
    alreadySpent: amountOutput,
  }),
  /** Nieopłacone jeszcze stałe zobowiązania — pozycje składające się na breakdown.fixedCommitments. */
  fixedCommitments: z.array(z.object({ label: z.string(), amount: amountOutput })),
  /** Rata każdego celu w tym okresie — pozycje breakdown.goalContributions. */
  goalContributions: z.array(z.object({ goalId: idSchema, amount: amountOutput })),
});

/** Body `POST /budget/simulate`. Kategoria jak w specyfikacji: "kwota i kategoria przed zakupem". */
export const simulatePurchaseRequestSchema = z.object({
  amount: amountSchema,
  categoryId: idSchema,
});

/** Odpowiedź `POST /budget/simulate`. */
export const simulationResultSchema = z.object({
  canAfford: z.boolean(),
  riskLevel: z.enum(["safe", "tight", "over"]),
  /** Stan przed zakupem — żeby UI mogło pokazać "dziennie: z X na Y". */
  before: z.object({ availableBalance: amountOutput, dailyAllowance: amountOutput }),
  remainingAfter: amountOutput,
  dailyAllowanceAfter: amountOutput,
  goalImpacts: z.array(z.object({ goalId: idSchema, delayDays: z.number().int() })),
});

/** Stan budżetu w bieżącym okresie. */
export type BudgetSummary = z.infer<typeof budgetSummarySchema>;
/** Dane symulowanego zakupu. */
export type SimulatePurchaseRequest = z.infer<typeof simulatePurchaseRequestSchema>;
/** Wynik symulacji zakupu. */
export type SimulationResult = z.infer<typeof simulationResultSchema>;
