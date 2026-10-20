import { z } from "zod";

import { idSchema, isoDateOutputSchema } from "../common/schemas.js";
import { recurrenceFrequencySchema } from "../recurring-rules/schemas.js";

/** Klucz wykrytej grupy („n|kategoria|spotify”) — z odpowiedzi `GET /subscriptions`. */
const keySchema = z.string().min(1).max(300);

/** Body `POST /subscriptions/confirm` — „To subskrypcja”. */
export const confirmSubscriptionSchema = z.object({
  key: keySchema,
  /** Nazwa stałej płatności. Wydatki bez notatki appka nazywa kategorią. */
  name: z.string().trim().min(1).max(100),
});

/** Body `POST /subscriptions/dismissals` — „To nie subskrypcja”. */
export const dismissSubscriptionSchema = z.object({ key: keySchema });

/** Query `DELETE /subscriptions/dismissals` — „Cofnij” po odrzuceniu. */
export const undismissSubscriptionQuerySchema = dismissSubscriptionSchema;

const priceChangeSchema = z.object({
  from: z.number().int(),
  to: z.number().int(),
  since: isoDateOutputSchema,
  /** Ujemna przy obniżce. */
  yearlyDelta: z.number().int(),
});

const costFields = {
  monthly: z.number().int(),
  yearly: z.number().int(),
};

/** Potwierdzona subskrypcja — stała płatność oznaczona jako subskrypcja. */
export const confirmedSubscriptionSchema = z.object({
  ruleId: idSchema,
  name: z.string(),
  categoryId: idSchema.nullable(),
  frequency: recurrenceFrequencySchema,
  interval: z.number().int(),
  amount: z.number().int(),
  ...costFields,
  priceChange: priceChangeSchema.nullable(),
});

/** Wykryta, jeszcze niepotwierdzona subskrypcja. */
export const detectedSubscriptionSchema = z.object({
  key: z.string(),
  /** `null` = wydatki bez notatki; appka pokazuje wtedy nazwę kategorii. */
  name: z.string().nullable(),
  categoryId: idSchema.nullable(),
  frequency: recurrenceFrequencySchema,
  /** Kwota ostatniej płatności. */
  amount: z.number().int(),
  ...costFields,
  paymentsCount: z.number().int(),
  lastDate: isoDateOutputSchema,
  nextDate: isoDateOutputSchema,
  priceChange: priceChangeSchema.nullable(),
});

const totalSchema = z.object({ count: z.number().int(), ...costFields });

/** Odpowiedź `GET /subscriptions`. Suma główna tylko z potwierdzonych. */
export const subscriptionsOverviewSchema = z.object({
  confirmed: z.array(confirmedSubscriptionSchema),
  detected: z.array(detectedSubscriptionSchema),
  totals: z.object({ confirmed: totalSchema, detected: totalSchema }),
});

/** „To subskrypcja”: klucz wykrytej pozycji i nazwa stałej płatności. */
export type ConfirmSubscriptionInput = z.infer<typeof confirmSubscriptionSchema>;
/** „To nie subskrypcja”. */
export type DismissSubscriptionInput = z.infer<typeof dismissSubscriptionSchema>;
/** Zmiana ceny w odpowiedzi API. */
export type PriceChangeOutput = z.infer<typeof priceChangeSchema>;
/** Potwierdzona subskrypcja w odpowiedzi API. */
export type ConfirmedSubscriptionOutput = z.infer<typeof confirmedSubscriptionSchema>;
/** Wykryta subskrypcja w odpowiedzi API. */
export type DetectedSubscriptionOutput = z.infer<typeof detectedSubscriptionSchema>;
/** Ekran „Subskrypcje”. */
export type SubscriptionsOverviewOutput = z.infer<typeof subscriptionsOverviewSchema>;
