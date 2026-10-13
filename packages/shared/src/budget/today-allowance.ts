import { grosze, type Grosze } from "../money.js";

/** Dzisiejszy limit z przenoszeniem — patrz {@link calculateTodayAllowance}. */
export interface TodayAllowance {
  /** Ile może kosztować dziś: dzisiejszy przydział plus to, co zostało z wczoraj. */
  limit: Grosze;
  /** Bieżące wydatki z dziś (bez opłat stałych płatności i „Wydatków przed Finso”). */
  spent: Grosze;
  /** `limit − spent`; ujemne, gdy dziś wydano więcej. */
  left: Grosze;
  /** Niewydana część wczorajszego przydziału, dodana do dziś; 0, gdy nic nie zostało. */
  carriedFromYesterday: Grosze;
  /** Ile dostanie każdy kolejny dzień, jeśli reszta dzisiejszego limitu zostanie na dziś. */
  nextDays: Grosze;
}

export interface TodayAllowanceInput {
  /** Saldo do końca okresu, już po dzisiejszych wydatkach. */
  availableBalance: Grosze;
  /** Dni do końca okresu, licząc dziś. */
  daysRemaining: number;
  spentToday: Grosze;
  /**
   * Bieżące wydatki z wczoraj; `null`, gdy „wczoraj” nie ma — pierwszy
   * dzień okresu albo dzień, od którego Finso prowadzi budżet.
   */
  spentYesterday: Grosze | null;
}

const ZERO: TodayAllowance = {
  limit: grosze(0),
  spent: grosze(0),
  left: grosze(0),
  carriedFromYesterday: grosze(0),
  nextDays: grosze(0),
};

/**
 * Dzienny limit z przenoszeniem (PRODUCT.md, Faza 1, punkt 11): niewydane
 * wczoraj zwiększa limit na dziś.
 *
 * Wczoraj rano saldo dzieliło się na `daysRemaining + 1` dni — to był
 * wczorajszy przydział. Co z niego zostało, przechodzi w całości na dziś:
 * `limit = przydział + reszta z wczoraj`. Przekroczenie wczoraj nie zabiera
 * dziś całej różnicy, tylko rozkłada się na wszystkie pozostałe dni
 * (`limit = saldo z rana / daysRemaining`). Ostatniego dnia okresu limitem
 * jest całe saldo z rana. Zaokrąglenia w dół; reszta groszy zostaje w saldzie.
 */
export function calculateTodayAllowance(input: TodayAllowanceInput): TodayAllowance {
  const { availableBalance, daysRemaining, spentToday, spentYesterday } = input;
  if (daysRemaining === 0) return ZERO;

  const morningBalance = availableBalance + spentToday;
  let yesterdayShare = 0;
  let carried = 0;
  if (spentYesterday !== null) {
    yesterdayShare = Math.floor((morningBalance + spentYesterday) / (daysRemaining + 1));
    carried = Math.max(0, yesterdayShare - spentYesterday);
  }

  let limit: number;
  if (daysRemaining === 1) limit = morningBalance;
  else if (carried > 0) limit = yesterdayShare + carried;
  else limit = Math.floor(morningBalance / daysRemaining);

  const left = grosze(limit - spentToday);
  return {
    limit: grosze(limit),
    spent: spentToday,
    left,
    carriedFromYesterday: grosze(carried),
    nextDays: nextDaysAllowance(availableBalance, left, daysRemaining),
  };
}

/**
 * Ile dostanie każdy dzień po dziś: saldo bez niewydanej części
 * dzisiejszego limitu (ta zostaje na dziś), równo na pozostałe dni,
 * w dół. Ostatniego dnia okresu i po nim — 0.
 */
export function nextDaysAllowance(
  availableBalance: Grosze,
  leftToday: Grosze,
  daysRemaining: number,
): Grosze {
  if (daysRemaining <= 1) return grosze(0);
  return grosze(Math.floor((availableBalance - Math.max(0, leftToday)) / (daysRemaining - 1)));
}
