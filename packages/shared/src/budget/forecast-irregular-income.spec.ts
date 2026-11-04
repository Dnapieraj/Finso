import { describe, expect, it } from "vitest";

import { isoDate } from "../date.js";
import { grosze } from "../money.js";
import { assembleBudgetInput, type BudgetSnapshot } from "./assemble-budget-input.js";
import { forecastIrregularIncome, incomeForecasts } from "./forecast-irregular-income.js";

/**
 * Prognoza dochodu nieregularnego (PRODUCT.md, Faza 2, punkt 13): budżet
 * z ostrożnej kwoty — 25. percentyl wpływów z ostatnich pełnych okresów —
 * zamiast z samych potwierdzonych wpływów. Okres bez wpływów liczy się
 * jako zero. Za mało historii (mniej niż 3 pełne okresy) → brak prognozy.
 *
 * Okresy w testach: dzień wypłaty 1., dziś 15.10.2026 → bieżący okres to
 * październik, pełne poprzednie: wrzesień, sierpień, lipiec…
 */
const d = isoDate;
const g = grosze;

const entry = (date: string, amount: number) => ({ date: d(date), amount: g(amount) });

const base = { today: d("2026-10-15"), periodStartDay: 1, trackedSince: d("2026-01-01") };

describe("forecastIrregularIncome", () => {
  it("6 pełnych okresów: 25. percentyl — drugi najniższy", () => {
    const entries = [
      entry("2026-04-10", 900_000),
      entry("2026-05-03", 300_000),
      entry("2026-06-20", 700_000),
      entry("2026-07-08", 450_000),
      entry("2026-08-30", 600_000),
      entry("2026-09-15", 800_000),
    ];

    expect(forecastIrregularIncome({ ...base, entries })).toEqual({
      forecast: 450_000,
      periods: 6,
      low: 300_000,
      high: 900_000,
    });
  });

  it("kilka wpływów w jednym okresie się sumuje", () => {
    const entries = [
      entry("2026-07-02", 200_000),
      entry("2026-07-28", 300_000),
      entry("2026-08-10", 400_000),
      entry("2026-09-10", 600_000),
    ];

    expect(
      forecastIrregularIncome({ ...base, trackedSince: d("2026-07-01"), entries }),
    ).toMatchObject({ forecast: 400_000, periods: 3, low: 400_000 });
  });

  it("okres bez wpływów liczy się jako zero — to też jest typowy miesiąc", () => {
    const entries = [entry("2026-08-10", 500_000), entry("2026-09-10", 500_000)];

    expect(forecastIrregularIncome({ ...base, trackedSince: d("2026-07-01"), entries })).toEqual({
      forecast: 0,
      periods: 3,
      low: 0,
      high: 500_000,
    });
  });

  it("3 pełne okresy wystarczą; 25. percentyl z trzech to najniższy", () => {
    const entries = [
      entry("2026-07-10", 500_000),
      entry("2026-08-10", 400_000),
      entry("2026-09-10", 600_000),
    ];

    expect(
      forecastIrregularIncome({ ...base, trackedSince: d("2026-07-01"), entries }),
    ).toMatchObject({ forecast: 400_000, periods: 3 });
  });

  it("za mało historii: 2 pełne okresy → brak prognozy", () => {
    expect(
      forecastIrregularIncome({
        ...base,
        trackedSince: d("2026-08-01"),
        entries: [entry("2026-08-10", 500_000), entry("2026-09-10", 500_000)],
      }),
    ).toBeNull();
  });

  it("okres, w którym zaczęło się śledzenie, nie jest pełny — nie liczy się", () => {
    // Od 15.07: lipiec niepełny, pełne tylko sierpień i wrzesień.
    expect(
      forecastIrregularIncome({ ...base, trackedSince: d("2026-07-15"), entries: [] }),
    ).toBeNull();
  });

  it("bez daty początku śledzenia: ostatnie 6 pełnych okresów", () => {
    const result = forecastIrregularIncome({
      today: base.today,
      periodStartDay: 1,
      entries: [entry("2026-09-10", 500_000)],
    });

    expect(result).toMatchObject({ periods: 6, forecast: 0, high: 500_000 });
  });

  it("bieżący okres i wpływy starsze niż 6 okresów nie wchodzą do prognozy", () => {
    const entries = [
      entry("2026-03-10", 9_000_000),
      entry("2026-10-01", 9_000_000),
      entry("2026-07-10", 100_000),
      entry("2026-08-10", 100_000),
      entry("2026-09-10", 100_000),
    ];

    expect(
      forecastIrregularIncome({ ...base, trackedSince: d("2026-07-01"), entries }),
    ).toMatchObject({ forecast: 100_000, high: 100_000 });
  });

  it("okresy od dnia wypłaty: 10. dnia, a nie kalendarzowe miesiące", () => {
    // Dziś 5.10 → bieżący okres 10.09–9.10; pełne: 10.08–9.09, 10.07–9.08, 10.06–9.07.
    const entries = [
      entry("2026-06-12", 300_000),
      entry("2026-07-11", 300_000),
      entry("2026-09-09", 300_000),
      entry("2026-09-10", 9_000_000),
    ];

    expect(
      forecastIrregularIncome({
        today: d("2026-10-05"),
        periodStartDay: 10,
        trackedSince: d("2026-06-10"),
        entries,
      }),
    ).toEqual({ forecast: 300_000, periods: 3, low: 300_000, high: 300_000 });
  });
});

describe("prognoza w budżecie", () => {
  const sourceId = "src-freelance";

  const freelance = {
    id: sourceId,
    name: "Zlecenia",
    kind: "IRREGULAR" as const,
    expectedAmount: null,
    isActive: true,
    schedule: null,
    trackedSince: d("2026-07-01"),
  };

  /** Freelancer: lipiec 5000, sierpień 4000, wrzesień 6000 → prognoza 4000 zł. */
  function snapshot(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
    return {
      today: d("2026-10-15"),
      periodStartDay: 1,
      trackedSince: d("2026-07-01"),
      incomeSources: [freelance],
      incomeEntries: [
        {
          incomeSourceId: sourceId,
          amount: g(500_000),
          date: d("2026-07-10"),
          status: "CONFIRMED",
        },
        {
          incomeSourceId: sourceId,
          amount: g(400_000),
          date: d("2026-08-10"),
          status: "CONFIRMED",
        },
        {
          incomeSourceId: sourceId,
          amount: g(600_000),
          date: d("2026-09-10"),
          status: "CONFIRMED",
        },
      ],
      expenseRules: [],
      transactions: [],
      goals: [],
      ...overrides,
    };
  }

  it("nic jeszcze nie wpłynęło: budżet z prognozy", () => {
    expect(assembleBudgetInput(snapshot()).periodIncome).toBe(400_000);
  });

  it("wpłynęło mniej niż prognoza: reszta prognozy dalej się liczy", () => {
    const withIncome = snapshot();
    withIncome.incomeEntries.push({
      incomeSourceId: sourceId,
      amount: g(150_000),
      date: d("2026-10-05"),
      status: "CONFIRMED",
    });

    expect(assembleBudgetInput(withIncome).periodIncome).toBe(400_000);
  });

  it("wpłynęło więcej niż prognoza: liczy się to, co wpłynęło", () => {
    const withIncome = snapshot();
    withIncome.incomeEntries.push({
      incomeSourceId: sourceId,
      amount: g(700_000),
      date: d("2026-10-05"),
      status: "CONFIRMED",
    });

    expect(assembleBudgetInput(withIncome).periodIncome).toBe(700_000);
  });

  it("niepotwierdzone wpływy nie wchodzą ani do historii, ani do okresu", () => {
    const withPending = snapshot();
    withPending.incomeEntries.push({
      incomeSourceId: sourceId,
      amount: g(9_000_000),
      date: d("2026-09-20"),
      status: "PENDING",
    });

    expect(assembleBudgetInput(withPending).periodIncome).toBe(400_000);
  });

  it("za mało historii: jak dotąd — tylko to, co wpłynęło", () => {
    const young = snapshot({
      incomeSources: [{ ...freelance, trackedSince: d("2026-08-01") }],
    });

    expect(assembleBudgetInput(young).periodIncome).toBe(0);
  });

  it("zarchiwizowane źródło: bez prognozy", () => {
    const archived = snapshot({
      incomeSources: [{ ...freelance, isActive: false }],
    });

    expect(assembleBudgetInput(archived).periodIncome).toBe(0);
  });

  it("incomeForecasts: prognoza i ile z niej jeszcze nie wpłynęło — do pokazania wprost", () => {
    const withIncome = snapshot();
    withIncome.incomeEntries.push({
      incomeSourceId: sourceId,
      amount: g(150_000),
      date: d("2026-10-05"),
      status: "CONFIRMED",
    });

    expect(incomeForecasts(withIncome)).toEqual([
      {
        incomeSourceId: sourceId,
        name: "Zlecenia",
        forecast: 400_000,
        periods: 3,
        low: 400_000,
        high: 600_000,
        received: 150_000,
        notYetReceived: 250_000,
      },
    ]);
  });

  it("incomeForecasts: źródła regularne i bez prognozy się nie pojawiają", () => {
    const young = snapshot({
      incomeSources: [{ ...freelance, trackedSince: d("2026-09-01") }],
    });

    expect(incomeForecasts(young)).toEqual([]);
  });
});
