import { grosze, type Grosze } from "@vireo/shared";

/** Finso Plus prices as sold through App Store / Google Play (docs/PRODUCT.md §6). */
export const plusPrice = {
  monthly: grosze(1299),
  yearly: grosze(9900),
} as const;

/**
 * Monthly equivalent of the yearly plan. It is a cost, so the division
 * rounds up: the page never shows a price lower than what the user pays.
 */
export function yearlyPerMonth(yearly: Grosze): Grosze {
  return grosze(Math.ceil(yearly / 12));
}
