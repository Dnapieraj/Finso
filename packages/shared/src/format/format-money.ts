import type { Grosze } from "../money.js";

const NBSP = "\u00A0";
const GROSZE_PER_ZLOTY = 100;
// Polska norma (CLDR minimumGroupingDigits = 2): „1209” zostaje w całości,
// grupowanie zaczyna się od pięciu cyfr („12 096”).
const MIN_DIGITS_TO_GROUP = 5;

function groupThousands(digits: string): string {
  if (digits.length < MIN_DIGITS_TO_GROUP) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

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
export function formatMoney(amount: Grosze, options: FormatMoneyOptions = {}): string {
  if (!Number.isInteger(amount)) {
    throw new TypeError(
      `Kwota w groszach musi być liczbą całkowitą, otrzymano: ${String(amount)}.`,
    );
  }
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(
      `Kwota ${String(amount)} gr wykracza poza bezpieczny zakres liczb całkowitych.`,
    );
  }

  // `-0 < 0` to false, więc ujemne zero traktujemy jak zwykłe zero.
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const rest = abs % GROSZE_PER_ZLOTY;
  // Odjęcie reszty przed dzieleniem daje wynik dokładny, bez błędów floatów.
  let zloty = (abs - rest) / GROSZE_PER_ZLOTY;

  const { whole } = options;
  if (whole !== undefined && rest > 0) {
    // W stronę -∞ rośnie moduł kwoty ujemnej, w stronę +∞ — dodatniej.
    const awayFromZero = whole === "down" ? negative : !negative;
    if (awayFromZero) zloty += 1;
  }

  const isZero = whole === undefined ? abs === 0 : zloty === 0;
  const sign = isZero ? "" : negative ? "-" : options.sign === "always" ? "+" : "";
  const fraction = whole === undefined ? `,${String(rest).padStart(2, "0")}` : "";

  return `${sign}${groupThousands(String(zloty))}${fraction}${NBSP}zł`;
}
