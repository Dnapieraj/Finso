import { describe, expect, it } from "vitest";

import { grosze } from "../money.js";
import { calculateAvailableBalance } from "./calculate-available-balance.js";
import { calculateTodayAllowance, nextDaysAllowance } from "./today-allowance.js";

/**
 * Dzienny limit z przenoszeniem (PRODUCT.md, Faza 1, punkt 11):
 * niewydane wczoraj zwiększa limit na dziś — „Wczoraj zostało 20 zł,
 * dziś masz 254 zł”.
 *
 * Model: wczoraj rano saldo dzieliło się na D+1 dni, to był wczorajszy
 * przydział (b). Co z niego zostało, przechodzi w całości na dziś:
 * limit = b + reszta z wczoraj. Przekroczenie wczoraj NIE odbiera dziś
 * całej różnicy — rozkłada się na wszystkie pozostałe dni (limit =
 * saldo z rana / D), bo inaczej jeden drogi dzień zerowałby następny.
 */

/** 10 dni do końca okresu (z dziś), dziś nic nie wydano. */
const base = {
  daysRemaining: 10,
  spentToday: grosze(0),
};

describe("calculateTodayAllowance", () => {
  it("przykład z PRODUCT.md: wczoraj zostało 20 zł → dziś 254 zł zamiast 234 zł", () => {
    // Wczoraj rano: 2574 zł na 11 dni = 234 zł. Wydano 214 zł, zostało 20 zł.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(236_000),
      spentYesterday: grosze(21_400),
    });

    expect(today).toEqual({
      limit: 25_400,
      spent: 0,
      left: 25_400,
      carriedFromYesterday: 2_000,
      // Kolejne dni dostają wczorajszy przydział: (2360 − 254) / 9 = 234 zł.
      nextDays: 23_400,
    });
  });

  it("wczoraj nic nie wydano: cały wczorajszy przydział przechodzi na dziś", () => {
    // Wczoraj rano 2574 zł / 11 = 234 zł; nic nie wydano → dziś 2 × 234 zł.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(257_400),
      spentYesterday: grosze(0),
    });

    expect(today.carriedFromYesterday).toBe(23_400);
    expect(today.limit).toBe(46_800);
  });

  it("wczoraj wydano dokładnie przydział: nic nie przechodzi, dziś tyle samo", () => {
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(234_000),
      spentYesterday: grosze(23_400),
    });

    expect(today.carriedFromYesterday).toBe(0);
    expect(today.limit).toBe(23_400);
  });

  it("wczoraj przekroczono: dziś nie traci całej różnicy, rozkłada się na wszystkie dni", () => {
    // Wczoraj rano 2574 zł / 11 = 234 zł; wydano 344 zł, czyli 110 zł za dużo.
    // Rano zostało 2230 zł na 10 dni → 223 zł, a nie 234 − 110 = 124 zł.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(223_000),
      spentYesterday: grosze(34_400),
    });

    expect(today.carriedFromYesterday).toBe(0);
    expect(today.limit).toBe(22_300);
    expect(today.nextDays).toBe(22_300);
  });

  // null: pierwszy dzień okresu albo dzień onboardingu — wczoraj Finso
  // nie prowadził tego budżetu, więc nic z niego nie mogło „zostać”.
  it("brak „wczoraj” (null): saldo równo na wszystkie dni, nic nie przechodzi", () => {
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(500_000),
      spentYesterday: null,
    });

    expect(today.carriedFromYesterday).toBe(0);
    expect(today.limit).toBe(50_000);
  });

  it("dzisiejsze wydatki nie zmieniają limitu, tylko to, co zostało", () => {
    // Saldo już po 100 zł wydanych dziś; rano było 2360 zł.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(226_000),
      spentToday: grosze(10_000),
      spentYesterday: grosze(21_400),
    });

    expect(today.limit).toBe(25_400);
    expect(today.spent).toBe(10_000);
    expect(today.left).toBe(15_400);
    expect(today.nextDays).toBe(23_400);
  });

  it("dziś przekroczono: ujemne „zostało”, a kolejne dni dostają mniej", () => {
    // Rano 2360 zł, wydano dziś 400 zł przy limicie 254 zł.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(196_000),
      spentToday: grosze(40_000),
      spentYesterday: grosze(21_400),
    });

    expect(today.left).toBe(-14_600);
    // Z dzisiejszego limitu nic nie zostało: całe saldo 1960 zł / 9 dni = 217,77 zł.
    expect(today.nextDays).toBe(21_777);
  });

  it("ostatni dzień okresu: wolno wydać całe saldo, następnych dni nie ma", () => {
    const today = calculateTodayAllowance({
      ...base,
      daysRemaining: 1,
      availableBalance: grosze(30_001),
      spentYesterday: grosze(10_000),
    });

    // Wczoraj rano 400,01 zł / 2 = 200 zł; zostało 100 zł.
    expect(today.carriedFromYesterday).toBe(10_000);
    expect(today.limit).toBe(30_001);
    expect(today.nextDays).toBe(0);
  });

  it("po końcu okresu (0 dni): same zera", () => {
    expect(
      calculateTodayAllowance({
        ...base,
        daysRemaining: 0,
        availableBalance: grosze(5_000),
        spentToday: grosze(1_000),
        spentYesterday: grosze(0),
      }),
    ).toEqual({ limit: 0, spent: 0, left: 0, carriedFromYesterday: 0, nextDays: 0 });
  });

  it("pod kreską: limit ujemny jak dzienna kwota (w stronę −∞), nic nie przechodzi", () => {
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(-10_001),
      spentYesterday: grosze(0),
    });

    expect(today.carriedFromYesterday).toBe(0);
    // floor(−10 001 / 10) = −1001
    expect(today.limit).toBe(-1_001);
  });

  it("zerowy dochód, nic nie wydano: zera", () => {
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(0),
      spentYesterday: grosze(0),
    });

    expect(today).toEqual({ limit: 0, spent: 0, left: 0, carriedFromYesterday: 0, nextDays: 0 });
  });

  it("reszta groszy z dzielenia zostaje w saldzie, nie trafia do dzisiejszego limitu", () => {
    // Wczoraj rano 1000,02 zł / 11 = 90,91 zł (reszta 1 gr); nic nie wydano.
    const today = calculateTodayAllowance({
      ...base,
      availableBalance: grosze(100_002),
      spentYesterday: grosze(0),
    });

    expect(today.carriedFromYesterday).toBe(9_091);
    expect(today.limit).toBe(18_182);
  });
});

describe("nextDaysAllowance", () => {
  it("dzień po dziś: saldo bez niewydanej części dzisiejszego limitu, równo na resztę dni", () => {
    expect(nextDaysAllowance(grosze(236_000), grosze(25_400), 10)).toBe(23_400);
  });

  it("dziś przekroczone: liczy się całe saldo (nic nie zostało na dziś)", () => {
    expect(nextDaysAllowance(grosze(196_000), grosze(-14_600), 10)).toBe(21_777);
  });

  it("ostatni dzień albo po okresie: 0", () => {
    expect(nextDaysAllowance(grosze(5_000), grosze(5_000), 1)).toBe(0);
    expect(nextDaysAllowance(grosze(5_000), grosze(0), 0)).toBe(0);
  });
});

describe("calculateAvailableBalance → today", () => {
  const input = {
    periodIncome: grosze(500_000),
    period: { start: "2026-09-10", end: "2026-10-09" },
    remainingFixedCommitments: [],
    goalContributions: [],
  } as const;

  it("liczy dzisiejszy limit z wydatków dziś i wczoraj", () => {
    // 28.09: 12 dni do końca. Wydano 2640 zł, w tym 50 zł wczoraj i 20 zł dziś.
    const result = calculateAvailableBalance({
      ...input,
      asOf: "2026-09-28",
      alreadySpent: grosze(264_000),
      spentToday: grosze(2_000),
      spentYesterday: grosze(5_000),
    });

    // Rano 2380 zł; wczoraj rano 2430 zł / 13 = 186,92 zł; zostało 136,92 zł.
    expect(result.today).toEqual({
      limit: 32_384,
      spent: 2_000,
      left: 30_384,
      carriedFromYesterday: 13_692,
      nextDays: 18_692,
    });
  });

  it("bez podanych wydatków dziś/wczoraj — dzień bez wydatków i bez „wczoraj”", () => {
    const result = calculateAvailableBalance({
      ...input,
      asOf: "2026-09-10",
      alreadySpent: grosze(0),
    });

    // Pierwszy dzień okresu: 5000 zł / 30 dni.
    expect(result.today.limit).toBe(16_666);
    expect(result.today.carriedFromYesterday).toBe(0);
  });
});
