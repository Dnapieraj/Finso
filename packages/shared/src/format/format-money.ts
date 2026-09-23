import type { Grosze } from "../money.js";

/**
 * Opcje {@link formatMoney}.
 *
 * Moduł `format/` to warstwa prezentacji współdzielona przez web i mobile:
 * silnik budżetu (`budget/`) nigdy go nie importuje, liczy wyłącznie
 * na groszach.
 */
export interface FormatMoneyOptions {
  /**
   * Pokaż pełne złote zamiast groszy. Kierunek jest obowiązkowy, bo to,
   * która strona jest „bezpieczna”, zależy od znaczenia kwoty:
   * - `'down'` (w stronę -∞) — dla środków do wydania: 86,99 → „86 zł”,
   *   a -86,40 → „-87 zł” (większy dług).
   * - `'up'` (w stronę +∞) — dla kosztów: 26,01 → „27 zł”.
   */
  readonly whole?: "down" | "up";
  /**
   * `'always'` dodaje „+” przed kwotą dodatnią (np. należność od znajomego).
   * Zero nigdy nie dostaje znaku. Domyślnie `'auto'`: znak tylko dla ujemnych.
   */
  readonly sign?: "auto" | "always";
}

/**
 * Formatuje kwotę w groszach do polskiego zapisu złotówek: „1209,60 zł”,
 * „12 096,00 zł”, „-86,40 zł”. Wynik jest identyczny z
 * `Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })`,
 * ale liczony na liczbach całkowitych, bez `Intl`, żeby web (V8) i mobile
 * (Hermes) zawsze dawały ten sam tekst.
 *
 * Spacje (separator tysięcy i przed „zł”) są nierozdzielające (U+00A0),
 * żeby kwota nie łamała się między wierszami.
 *
 * @throws {TypeError} gdy `amount` nie jest liczbą całkowitą.
 * @throws {RangeError} gdy `amount` wykracza poza `Number.MAX_SAFE_INTEGER`.
 */
export declare function formatMoney(amount: Grosze, options?: FormatMoneyOptions): string;
