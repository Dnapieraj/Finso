/**
 * Where „Otwórz sklep” leads. Google Play by the package id from app.json
 * (a test keeps them equal). The App Store id exists only after the first
 * submission (stage 8); until then iOS opens the website, which links to
 * both stores.
 */
export const STORE_URLS = {
  android: "https://play.google.com/store/apps/details?id=app.finso",
  ios: "https://finso.app",
} as const;
