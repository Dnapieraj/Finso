import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { grosze } from "../money.js";
import { categoryLimitStatuses, leanMonth, type LimitExpense } from "./category-limits.js";
import type { IncomeForecastLine } from "./forecast-irregular-income.js";

/**
 * Limity na kategorie (PRODUCT.md, Faza 2, punkt 21) i podpowiedzi
 * „chudego miesiąca” dla dochodu nieregularnego.
 *
 * Okresy w testach: dzień wypłaty 1., dziś 21.10.2026 → bieżący okres to
 * październik (31 dni, zostało 11 z dzisiejszym), pełne poprzednie:
 * wrzesień, sierpień, lipiec…
 */
const d = isoDate;
const g = grosze;

const FOOD = "cat-food";
const FUN = "cat-fun";
const TRANSPORT = "cat-transport";
const HOME = "cat-home";

const expense = (categoryId: string | null, amount: number, date: string): LimitExpense => ({
  categoryId,
  amount: g(amount),
  date: d(date),
  status: "CONFIRMED",
  recurringRuleId: null,
  beforeFinso: false,
});

const today = d("2026-10-21");
const base = { today, periodStartDay: 1 };

describe("categoryLimitStatuses", () => {
  it("liczy wydatki kategorii w bieżącym okresie: wydane, zostało, dziennie do końca", () => {
    const expenses = [
      expense(FOOD, 30_000, "2026-10-03"),
      expense(FOOD, 20_000, "2026-10-21"),
      // Poprzedni okres i inna kategoria się nie liczą.
      expense(FOOD, 99_000, "2026-09-30"),
      expense(FUN, 5_000, "2026-10-10"),
    ];

    expect(
      categoryLimitStatuses({
        ...base,
        limits: [{ categoryId: FOOD, amount: g(80_000) }],
        expenses,
      }),
    ).toEqual([
      {
        categoryId: FOOD,
        limit: 80_000,
        spent: 50_000,
        left: 30_000,
        // 300 zł na 11 dni (21–31.10) = 27,27 zł → w dół.
        perDayLeft: 2_727,
        state: "ok",
      },
    ]);
  });

  it("pomija niepotwierdzone wydatki", () => {
    const pending: LimitExpense = { ...expense(FOOD, 50_000, "2026-10-05"), status: "PENDING" };

    expect(
      categoryLimitStatuses({
        ...base,
        limits: [{ categoryId: FOOD, amount: g(80_000) }],
        expenses: [pending],
      })[0],
    ).toMatchObject({ spent: 0, left: 80_000 });
  });

  it("płatności stałych zobowiązań też się liczą — to wydatek w tej kategorii", () => {
    const rent = { ...expense(HOME, 200_000, "2026-10-01"), recurringRuleId: "rule-rent" };

    expect(
      categoryLimitStatuses({
        ...base,
        limits: [{ categoryId: HOME, amount: g(250_000) }],
        expenses: [rent],
      })[0],
    ).toMatchObject({ spent: 200_000, left: 50_000, state: "near" });
  });

  it("blisko: zostało 20% albo mniej; równo limit to jeszcze nie przekroczenie", () => {
    const status = (spent: number) =>
      categoryLimitStatuses({
        ...base,
        limits: [{ categoryId: FOOD, amount: g(100_000) }],
        expenses: [expense(FOOD, spent, "2026-10-10")],
      })[0];

    expect(status(79_999)).toMatchObject({ state: "ok" });
    expect(status(80_000)).toMatchObject({ state: "near", left: 20_000 });
    expect(status(100_000)).toMatchObject({ state: "near", left: 0, perDayLeft: 0 });
  });

  it("przekroczony: ujemne „zostało”, nic dziennie", () => {
    expect(
      categoryLimitStatuses({
        ...base,
        limits: [{ categoryId: FOOD, amount: g(50_000) }],
        expenses: [expense(FOOD, 64_550, "2026-10-10")],
      })[0],
    ).toMatchObject({ spent: 64_550, left: -14_550, perDayLeft: 0, state: "over" });
  });

  it("pusta historia: wszystko do wydania; kolejność jak w limitach", () => {
    expect(
      categoryLimitStatuses({
        ...base,
        limits: [
          { categoryId: FUN, amount: g(20_000) },
          { categoryId: FOOD, amount: g(80_000) },
        ],
        expenses: [],
      }).map((status) => [status.categoryId, status.left]),
    ).toEqual([
      [FUN, 20_000],
      [FOOD, 80_000],
    ]);
  });

  it("ostatni dzień okresu: cała reszta na dziś", () => {
    expect(
      categoryLimitStatuses({
        today: d("2026-10-31"),
        periodStartDay: 1,
        limits: [{ categoryId: FOOD, amount: g(80_000) }],
        expenses: [],
      })[0],
    ).toMatchObject({ perDayLeft: 80_000 });
  });

  it("rok przestępny: okres od 10.02.2028 ma 29 lutego", () => {
    // Okres 10.02–9.03.2028; z 28.02 zostało 11 dni (28, 29.02 i 1–9.03).
    expect(
      categoryLimitStatuses({
        today: d("2028-02-28"),
        periodStartDay: 10,
        limits: [{ categoryId: FOOD, amount: g(110_000) }],
        expenses: [],
      })[0],
    ).toMatchObject({ perDayLeft: 10_000 });
  });
});

describe("leanMonth", () => {
  /** Prognoza jednego źródła: liczymy 3000 zł, zwykle wpływa 5000 zł. */
  const forecast = (overrides: Partial<IncomeForecastLine> = {}): IncomeForecastLine => ({
    incomeSourceId: "src",
    name: "Zlecenia",
    forecast: g(300_000),
    periods: 4,
    low: g(250_000),
    high: g(700_000),
    typical: g(500_000),
    received: g(0),
    notYetReceived: g(300_000),
    ...overrides,
  });

  /** Lipiec–wrzesień: jedzenie 900 zł, rozrywka 600 zł, transport 300 zł co miesiąc. */
  const history = ["2026-07-15", "2026-08-15", "2026-09-15"].flatMap((date) => [
    expense(FOOD, 90_000, date),
    expense(FUN, 60_000, date),
    expense(TRANSPORT, 30_000, date),
  ]);

  const lean = (overrides: Partial<Parameters<typeof leanMonth>[0]> = {}) =>
    leanMonth({
      ...base,
      trackedSince: d("2026-01-01"),
      forecasts: [forecast()],
      expenses: history,
      limits: [],
      ...overrides,
    });

  it("liczony dochód poniżej 85% zwykłego: chudy okres i o ile", () => {
    expect(lean()).toMatchObject({ counted: 300_000, typical: 500_000, shortfall: 200_000 });
  });

  it("podpowiada cięcia w największych kategoriach, najwyżej o 30% i w dół do 10 zł", () => {
    // Brakuje 2000 zł, zwykle 1800 zł w trzech kategoriach: każda tnie
    // swoją część, ale nie więcej niż 30% → 630, 420, 210 zł.
    expect(lean()?.suggestions).toEqual([
      { categoryId: FOOD, usual: 90_000, suggested: 63_000 },
      { categoryId: FUN, usual: 60_000, suggested: 42_000 },
      { categoryId: TRANSPORT, usual: 30_000, suggested: 21_000 },
    ]);
  });

  it("niedobór mały wobec wydatków: cięcie proporcjonalne do udziału kategorii", () => {
    // Liczymy 4200 zł, zwykle 5000 → brakuje 800 zł (84% < 85%); zwykle
    // 3000 + 2000 + 1000 zł. Jedzenie 3/6 · 800 = 400 → 2600 zł; rozrywka
    // 266,67 → 1733,33 → 1730 zł; transport 133,33 → 866,67 → 860 zł.
    const big = ["2026-07-15", "2026-08-15", "2026-09-15"].flatMap((date) => [
      expense(FOOD, 300_000, date),
      expense(FUN, 200_000, date),
      expense(TRANSPORT, 100_000, date),
    ]);

    expect(
      lean({ forecasts: [forecast({ forecast: g(420_000) })], expenses: big })?.suggestions,
    ).toEqual([
      { categoryId: FOOD, usual: 300_000, suggested: 260_000 },
      { categoryId: FUN, usual: 200_000, suggested: 173_000 },
      { categoryId: TRANSPORT, usual: 100_000, suggested: 86_000 },
    ]);
  });

  it("wpłynęło więcej niż prognoza: liczy się to, co wpłynęło", () => {
    expect(lean({ forecasts: [forecast({ received: g(450_000) })] })).toBeNull();
  });

  it("85% zwykłego i więcej to nie chudy okres", () => {
    expect(lean({ forecasts: [forecast({ forecast: g(425_000) })] })).toBeNull();
    expect(lean({ forecasts: [forecast({ forecast: g(424_999) })] })).not.toBeNull();
  });

  it("kilka źródeł: sumy z wszystkich", () => {
    const second = forecast({
      incomeSourceId: "src-2",
      forecast: g(200_000),
      typical: g(200_000),
    });

    expect(lean({ forecasts: [forecast(), second] })).toMatchObject({
      counted: 500_000,
      typical: 700_000,
    });
  });

  it("bez prognozy (dochód stały albo za mało historii) — nic", () => {
    expect(lean({ forecasts: [] })).toBeNull();
  });

  it("zerowy dochód zwykle: nie ma z czym porównać — nic", () => {
    expect(
      lean({ forecasts: [forecast({ forecast: g(0), typical: g(0), low: g(0), high: g(0) })] }),
    ).toBeNull();
  });

  it("stałe zobowiązania, wydatki sprzed Finso, bez kategorii i drobne — bez podpowiedzi", () => {
    const expenses = [
      { ...expense(HOME, 200_000, "2026-09-01"), recurringRuleId: "rule-rent" },
      { ...expense(FOOD, 200_000, "2026-09-01"), beforeFinso: true },
      expense(null, 200_000, "2026-09-03"),
      // 140 zł w jednym z trzech okresów = 46,66 zł średnio — poniżej 50 zł, nie ma co ciąć.
      expense(TRANSPORT, 14_000, "2026-09-05"),
      expense(FUN, 12_000, "2026-08-05"),
    ];

    expect(lean({ expenses })?.suggestions.map((s) => s.categoryId)).toEqual([]);
    expect(
      lean({
        expenses: [
          ...expenses,
          expense(TRANSPORT, 14_000, "2026-08-05"),
          expense(TRANSPORT, 14_000, "2026-07-05"),
        ],
      })?.suggestions,
    ).toEqual([{ categoryId: TRANSPORT, usual: 14_000, suggested: 9_000 }]);
  });

  it("średnia z pełnych okresów po dodaniu do Finso — miesiąc bez wydatków to zero", () => {
    // Śledzone od 1.08: dwa pełne okresy (sierpień, wrzesień); jedzenie tylko we wrześniu.
    expect(
      lean({
        trackedSince: d("2026-08-01"),
        expenses: [expense(FOOD, 90_000, "2026-09-10"), expense(FOOD, 90_000, "2026-07-10")],
      })?.suggestions,
    ).toEqual([{ categoryId: FOOD, usual: 45_000, suggested: 31_000 }]);
  });

  it("pusta historia (pierwszy okres w Finso): chudy okres bez podpowiedzi", () => {
    expect(lean({ trackedSince: d("2026-10-01") })).toMatchObject({
      shortfall: 200_000,
      suggestions: [],
    });
  });

  it("istniejący limit niższy niż podpowiedź — tej kategorii nie podpowiada", () => {
    expect(
      lean({ limits: [{ categoryId: FOOD, amount: g(60_000) }] })?.suggestions.map(
        (s) => s.categoryId,
      ),
    ).toEqual([FUN, TRANSPORT]);
  });

  it("równe średnie: stała kolejność po id kategorii", () => {
    const tie = ["2026-09-15"].flatMap((date) => [
      expense(TRANSPORT, 60_000, date),
      expense(FOOD, 60_000, date),
    ]);

    expect(lean({ expenses: tie })?.suggestions.map((s) => s.categoryId)).toEqual([
      FOOD,
      TRANSPORT,
    ]);
  });

  it("najwyżej trzy kategorie, od największej", () => {
    const more = [...history, expense(HOME, 300_000, "2026-09-20")];

    expect(lean({ expenses: more })?.suggestions.map((s) => s.categoryId)).toEqual([
      HOME,
      FOOD,
      FUN,
    ]);
  });
});
