import { formatMoney, grosze } from "@vireo/shared";

/**
 * An expected amount as the user will see it on the bank statement: exact
 * grosze, but "1500 zł" rather than "1500,00 zł" when there are none.
 * Whole zloty need no rounding, so the direction does not matter.
 */
export function formatExpected(amount: number): string {
  return amount % 100 === 0
    ? formatMoney(grosze(amount), { whole: "down" })
    : formatMoney(grosze(amount));
}
