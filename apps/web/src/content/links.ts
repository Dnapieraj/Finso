/**
 * Store listings. The app is not published yet, so both point at `#`;
 * swap in the real URLs here once the listings exist.
 */
export const storeLinks = {
  appStore: "#",
  googlePlay: "#",
} as const;

/** Legal pages linked from the footer (required by both app stores). */
export const legalLinks = {
  privacy: "/polityka-prywatnosci",
  terms: "/regulamin",
  deleteAccount: "/usuwanie-konta",
} as const;
