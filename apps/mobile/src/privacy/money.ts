import { formatMoney, type FormatMoneyOptions, type Grosze } from "@vireo/shared";

import { pl } from "../messages/pl";
import { useDevicePreferences } from "../preferences/device-preferences";

/** What a hidden amount looks like; the same everywhere, so it reads as one thing. */
export const HIDDEN_AMOUNT = "•••";

export interface Money {
  readonly hidden: boolean;
  /** formatMoney, or "•••" in privacy mode. Rounding stays the caller's choice. */
  format: (amount: Grosze, options?: FormatMoneyOptions) => string;
  /**
   * The text for screen readers: "•••" read aloud is "bullet bullet bullet",
   * so a hidden amount is said as "ukryta kwota".
   */
  spoken: (text: string) => string;
}

/** Amounts as the user chose to see them: shown, or hidden by the eye on the dashboard. */
export function useMoney(): Money {
  const { hideAmounts } = useDevicePreferences();
  return {
    hidden: hideAmounts,
    format: (amount, options) => (hideAmounts ? HIDDEN_AMOUNT : formatMoney(amount, options)),
    spoken: (text) => text.replaceAll(HIDDEN_AMOUNT, pl.privacy.hiddenSpoken),
  };
}
