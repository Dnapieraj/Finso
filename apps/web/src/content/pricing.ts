import { grosze } from "@vireo/shared";

/**
 * Finso is a paid app: one price, paid once when downloading from App Store
 * or Google Play, with no plans or in-app purchases (docs/PRODUCT.md §6).
 * Must match the price set in both stores.
 */
export const appPrice = grosze(1999);
