import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

/**
 * Crash reports through Sentry — only when the build has a DSN
 * (EXPO_PUBLIC_SENTRY_DSN, set for store builds in docs/PUBLIKACJA.md).
 * Locally and in CI there is none, so nothing leaves the phone.
 *
 * A report says what broke and where (stack trace, app and system version),
 * never whose money: no user, no request, no extra data, no screenshots, and
 * only screen-to-screen breadcrumbs — taps, logs and requests could carry
 * amounts or the e-mail address.
 */
export function startMonitoring(config: { dsn: string | undefined; appVersion: string }): boolean {
  if (!config.dsn) return false;
  Sentry.init({
    dsn: config.dsn,
    release: `finso@${config.appVersion}`,
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: keepNavigationOnly,
    beforeSend: withoutPersonalData,
  });
  return true;
}

function keepNavigationOnly(breadcrumb: Breadcrumb): Breadcrumb | null {
  return breadcrumb.category === "navigation" ? breadcrumb : null;
}

function withoutPersonalData(event: ErrorEvent): ErrorEvent {
  const { user: _user, request: _request, extra: _extra, ...rest } = event;
  return rest;
}
