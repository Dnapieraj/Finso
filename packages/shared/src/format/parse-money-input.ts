import { INT4_MAX } from "../common/schemas.js";
import { grosze, type Grosze } from "../money.js";

/** Dlaczego tekst nie jest poprawną kwotą — aplikacja dobiera do tego komunikat. */
export type MoneyInputError = "empty" | "invalid" | "zero" | "too-precise" | "too-large";

/** Wynik {@link parseMoneyInput}. */
export type ParseMoneyInputResult =
  | { readonly ok: true; readonly grosze: Grosze }
  | { readonly ok: false; readonly reason: MoneyInputError };

const MONEY_INPUT = /^\d*(?:[.,]\d*)?$/;
/** Najwięcej cyfr złotówek, które mieszczą się w int4 (21 474 836,47 zł). */
const MAX_WHOLE_DIGITS = 8;

/**
 * Zamienia kwotę wpisaną przez użytkownika („12,50”, „1 234,5”, „12.5”)
 * na grosze. Przecinek i kropka są równoważne; spacje (też twarde,
 * z wklejonego „1 234”) są pomijane. Liczone na cyfrach, nigdy przez
 * `parseFloat` — „0,29” to dokładnie 29 gr.
 *
 * Tylko kwoty dodatnie, najwyżej 2 miejsca po przecinku i nie więcej,
 * niż zmieści kolumna `Int` (int4) w bazie.
 */
export function parseMoneyInput(input: string): ParseMoneyInputResult {
  const text = input.replace(/\s/g, "");
  if (text === "") return { ok: false, reason: "empty" };
  if (!MONEY_INPUT.test(text) || text === "." || text === ",") {
    return { ok: false, reason: "invalid" };
  }

  const separator = text.search(/[.,]/);
  const whole = separator === -1 ? text : text.slice(0, separator);
  const fraction = separator === -1 ? "" : text.slice(separator + 1);

  if (fraction.length > 2) return { ok: false, reason: "too-precise" };
  if (whole.replace(/^0+/, "").length > MAX_WHOLE_DIGITS) {
    return { ok: false, reason: "too-large" };
  }

  // Najwyżej 8 + 2 cyfry — daleko w bezpiecznym zakresie liczb całkowitych.
  const value = Number(whole === "" ? "0" : whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (value === 0) return { ok: false, reason: "zero" };
  if (value > INT4_MAX) return { ok: false, reason: "too-large" };
  return { ok: true, grosze: grosze(value) };
}
