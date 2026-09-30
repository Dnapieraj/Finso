import { describe, expect, it } from "vitest";

import { completeOnboardingSchema, ONBOARDING_COMMITMENTS_MAX } from "./schemas.js";

const CATEGORY_ID = "00000000-0000-7000-8000-000000000003";

const regular = { kind: "REGULAR", name: "Wypłata", amount: 800_000, dayOfMonth: 10 } as const;
const rent = { name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: CATEGORY_ID };

function onboarding(overrides: Record<string, unknown> = {}) {
  return {
    periodStartDay: 10,
    timezone: "Europe/Warsaw",
    income: regular,
    commitments: [rent],
    ...overrides,
  };
}

const accepts = (input: unknown) => completeOnboardingSchema.safeParse(input).success;

describe("completeOnboardingSchema", () => {
  it("przyjmuje pełny onboarding z dochodem regularnym i zobowiązaniem", () => {
    const full = onboarding({ spentThisPeriod: 45_000 });

    expect(completeOnboardingSchema.parse(full)).toEqual(full);
  });

  it("zobowiązania można pominąć — domyślnie pusta lista", () => {
    const { commitments: _skipped, ...withoutCommitments } = onboarding();

    expect(completeOnboardingSchema.parse(withoutCommitments).commitments).toEqual([]);
  });

  describe("dzień wypłaty (periodStartDay)", () => {
    it.each([1, 28])("przyjmuje %i", (day) => {
      expect(accepts(onboarding({ periodStartDay: day }))).toBe(true);
    });

    it.each([0, 29, 31, 10.5])("odrzuca %s — okres musi startować w każdym miesiącu", (day) => {
      expect(accepts(onboarding({ periodStartDay: day }))).toBe(false);
    });
  });

  it("odrzuca nieznaną strefę czasową", () => {
    expect(accepts(onboarding({ timezone: "Mars/Olympus" }))).toBe(false);
  });

  describe("dochód regularny", () => {
    it("wymaga kwoty i dnia wpływu", () => {
      expect(accepts(onboarding({ income: { kind: "REGULAR", name: "Wypłata" } }))).toBe(false);
      expect(accepts(onboarding({ income: { ...regular, dayOfMonth: undefined } }))).toBe(false);
    });

    it("dzień wpływu 1–31: wypłata 31. przycina się w krótszych miesiącach", () => {
      expect(accepts(onboarding({ income: { ...regular, dayOfMonth: 31 } }))).toBe(true);
      expect(accepts(onboarding({ income: { ...regular, dayOfMonth: 0 } }))).toBe(false);
      expect(accepts(onboarding({ income: { ...regular, dayOfMonth: 32 } }))).toBe(false);
    });

    it("kwota to dodatnie grosze", () => {
      expect(accepts(onboarding({ income: { ...regular, amount: 0 } }))).toBe(false);
      expect(accepts(onboarding({ income: { ...regular, amount: 10.5 } }))).toBe(false);
    });

    it("nie przyjmuje pola z dochodu nieregularnego", () => {
      expect(accepts(onboarding({ income: { ...regular, receivedThisPeriod: 100 } }))).toBe(false);
    });
  });

  describe("dochód nieregularny", () => {
    const irregular = { kind: "IRREGULAR", name: "Zlecenia" } as const;

    it("to, co już wpłynęło w tym okresie, jest opcjonalne — domyślnie null", () => {
      expect(completeOnboardingSchema.parse(onboarding({ income: irregular })).income).toEqual({
        ...irregular,
        receivedThisPeriod: null,
      });
      expect(accepts(onboarding({ income: { ...irregular, receivedThisPeriod: 120_000 } }))).toBe(
        true,
      );
    });

    it("zero złotych to brak wpływu, nie wpływ — null zamiast 0", () => {
      expect(accepts(onboarding({ income: { ...irregular, receivedThisPeriod: 0 } }))).toBe(false);
    });

    it("nie ma stałej kwoty ani dnia — prognozę liczy silnik z wpływów", () => {
      expect(accepts(onboarding({ income: { ...irregular, amount: 800_000 } }))).toBe(false);
      expect(accepts(onboarding({ income: { ...irregular, dayOfMonth: 10 } }))).toBe(false);
    });
  });

  it("nazwa źródła dochodu jest przycinana i nie może być pusta", () => {
    expect(
      completeOnboardingSchema.parse(onboarding({ income: { ...regular, name: "  Pensja " } }))
        .income.name,
    ).toBe("Pensja");
    expect(accepts(onboarding({ income: { ...regular, name: "   " } }))).toBe(false);
  });

  describe("wydatki od ostatniej wypłaty", () => {
    it("są opcjonalne — domyślnie null", () => {
      expect(completeOnboardingSchema.parse(onboarding()).spentThisPeriod).toBeNull();
      expect(accepts(onboarding({ spentThisPeriod: 45_000 }))).toBe(true);
    });

    it("zero złotych to brak wydatku — null zamiast 0", () => {
      expect(accepts(onboarding({ spentThisPeriod: 0 }))).toBe(false);
    });

    it("kwota to całe grosze", () => {
      expect(accepts(onboarding({ spentThisPeriod: 450.5 }))).toBe(false);
    });
  });

  describe("stałe zobowiązania", () => {
    it.each([
      ["nazwy", { name: "  " }],
      ["kwoty", { amount: undefined }],
      ["dnia", { dayOfMonth: undefined }],
      ["kategorii", { categoryId: undefined }],
    ])("wymaga %s", (_field, change) => {
      expect(accepts(onboarding({ commitments: [{ ...rent, ...change }] }))).toBe(false);
    });

    it("dzień 1–31, kategoria to UUID", () => {
      expect(accepts(onboarding({ commitments: [{ ...rent, dayOfMonth: 31 }] }))).toBe(true);
      expect(accepts(onboarding({ commitments: [{ ...rent, dayOfMonth: 32 }] }))).toBe(false);
      expect(accepts(onboarding({ commitments: [{ ...rent, categoryId: "rachunki" }] }))).toBe(
        false,
      );
    });

    it(`najwyżej ${String(ONBOARDING_COMMITMENTS_MAX)} naraz`, () => {
      const many = (count: number) => Array.from({ length: count }, () => rent);

      expect(accepts(onboarding({ commitments: many(ONBOARDING_COMMITMENTS_MAX) }))).toBe(true);
      expect(accepts(onboarding({ commitments: many(ONBOARDING_COMMITMENTS_MAX + 1) }))).toBe(
        false,
      );
    });
  });
});
