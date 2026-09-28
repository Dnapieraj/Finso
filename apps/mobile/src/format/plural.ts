/** The three Polish plural forms: 1 cel, 2 cele, 5 celów. */
export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

/**
 * Picks the Polish plural form for `count`: `one` only for 1, `few` for
 * 2–4 in the last digit except 12–14, `many` for everything else (incl. 0).
 */
export function plural(count: number, forms: PluralForms): string {
  if (count === 1) return forms.one;
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms.few;
  return forms.many;
}
