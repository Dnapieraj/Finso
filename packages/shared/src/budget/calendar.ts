// Wewnętrzna arytmetyka kalendarzowa silnika budżetu (niewyeksportowana
// z pakietu). Operuje na "indeksie miesiąca" (rok × 12 + miesiąc − 1),
// bo przesuwanie o N miesięcy przez przełom roku to wtedy zwykłe dodawanie.

import { isoDate, type IsoDate } from "../date.js";

/** Rok i miesiąc (1-12) daty kalendarzowej. */
export function yearMonth(date: IsoDate): { year: number; month: number; day: number } {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/** Indeks miesiąca daty: styczeń 2026 i luty 2026 różnią się o 1. */
export function monthIndexOf(date: IsoDate): number {
  const { year, month } = yearMonth(date);
  return year * 12 + (month - 1);
}

function daysInMonth(monthIndex: number): number {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex % 12; // 0-11
  // Dzień 0 następnego miesiąca = ostatni dzień tego miesiąca.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Dzień `day` w miesiącu o indeksie `monthIndex`, przycięty do ostatniego
 * dnia miesiąca (31 w lutym → 28 lub 29).
 */
export function clampedDayInMonth(monthIndex: number, day: number): IsoDate {
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const clamped = Math.min(day, daysInMonth(monthIndex));
  return isoDate(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`,
  );
}

/** Dzień tygodnia: 0 = niedziela ... 6 = sobota (jak `Date.getUTCDay`). */
export function dayOfWeekOf(date: IsoDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Późniejsza z dwóch dat. */
export function laterOf(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
