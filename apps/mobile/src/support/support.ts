import Constants from "expo-constants";
import { Platform } from "react-native";

import { pl } from "../messages/pl";

const t = pl.support;

/** The same address the website gives (apps/web/src/content/site.ts; a test keeps them equal). */
export const CONTACT_EMAIL = "kontakt@finso.app";

/** Placeholder domain until publication, like the website's `siteUrl`. */
const SITE_URL = "https://finso.app";

/** Apple guideline 5.1.1: the privacy policy (and terms) reachable from inside the app. */
export const LEGAL_URLS = {
  privacy: `${SITE_URL}/polityka-prywatnosci`,
  terms: `${SITE_URL}/regulamin`,
} as const;

/** The version from app.json ("0.1.0"); "?" if the build carries no config. */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? "?";
}

/**
 * A ready e-mail to support: what helps to reproduce a problem (app and
 * system version) and a reminder to leave money out — none of the user's
 * financial data goes into it.
 */
export function supportMailUrl(device: {
  appVersion: string;
  os: string;
  osVersion: string;
}): string {
  const system = `${t.osNames[device.os] ?? device.os} ${device.osVersion}`;
  const body = [
    t.mailPrompt,
    "",
    "",
    "",
    "—",
    t.mailVersion(device.appVersion),
    t.mailSystem(system),
    t.mailNoMoney,
  ].join("\n");
  const query = `subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${CONTACT_EMAIL}?${query}`;
}

/** The support e-mail for this phone. */
export function thisDeviceSupportMailUrl(): string {
  return supportMailUrl({
    appVersion: appVersion(),
    os: Platform.OS,
    osVersion: String(Platform.Version),
  });
}
