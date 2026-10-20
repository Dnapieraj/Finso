import { describe, expect, it } from "vitest";

import {
  confirmSubscriptionSchema,
  dismissSubscriptionSchema,
  subscriptionsOverviewSchema,
} from "./schemas.js";

const KEY = "n|01a0cf55-89a0-7159-b809-6b5abf846e15|spotify";

describe("confirmSubscriptionSchema", () => {
  it("przyjmuje klucz i nazwę, nazwa bez spacji na brzegach", () => {
    expect(confirmSubscriptionSchema.parse({ key: KEY, name: "  Spotify " })).toEqual({
      key: KEY,
      name: "Spotify",
    });
  });

  it.each([
    ["pusty klucz", { key: "", name: "Spotify" }],
    ["za długi klucz", { key: "x".repeat(301), name: "Spotify" }],
    ["pusta nazwa", { key: KEY, name: "   " }],
    ["za długa nazwa", { key: KEY, name: "x".repeat(101) }],
  ])("odrzuca: %s", (_case, body) => {
    expect(confirmSubscriptionSchema.safeParse(body).success).toBe(false);
  });
});

describe("dismissSubscriptionSchema", () => {
  it("przyjmuje klucz", () => {
    expect(dismissSubscriptionSchema.parse({ key: KEY })).toEqual({ key: KEY });
  });

  it("odrzuca pusty klucz", () => {
    expect(dismissSubscriptionSchema.safeParse({ key: "" }).success).toBe(false);
  });
});

describe("subscriptionsOverviewSchema", () => {
  it("odpowiedź bez harmonogramu wykrytej pozycji (to szczegół API)", () => {
    const detected = {
      key: KEY,
      name: "Spotify",
      categoryId: null,
      frequency: "MONTHLY",
      amount: 2_700,
      monthly: 2_700,
      yearly: 32_400,
      paymentsCount: 4,
      lastDate: "2026-10-10",
      nextDate: "2026-11-10",
      priceChange: { from: 2_300, to: 2_700, since: "2026-10-10", yearlyDelta: 4_800 },
    };
    const body = {
      confirmed: [],
      detected: [{ ...detected, schedule: { frequency: "MONTHLY" } }],
      totals: {
        confirmed: { count: 0, monthly: 0, yearly: 0 },
        detected: { count: 1, monthly: 2_700, yearly: 32_400 },
      },
    };

    expect(subscriptionsOverviewSchema.parse(body).detected).toEqual([detected]);
  });
});
