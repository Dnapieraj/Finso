import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

import { startMonitoring } from "../src/monitoring/sentry";

const init = jest.mocked(Sentry.init);

/** The options the app passed to Sentry.init. */
function options() {
  const [first] = init.mock.calls[0] ?? [];
  if (!first) throw new Error("Sentry.init was not called");
  return first;
}

it("without a DSN (local, CI, a build without Sentry) nothing is sent anywhere", () => {
  expect(startMonitoring({ dsn: undefined, appVersion: "1.0.0" })).toBe(false);
  expect(startMonitoring({ dsn: "", appVersion: "1.0.0" })).toBe(false);

  expect(init).not.toHaveBeenCalled();
});

it("with a DSN: crash reports with the app version and no personal data", () => {
  expect(
    startMonitoring({ dsn: "https://key@o1.ingest.de.sentry.io/1", appVersion: "1.0.0" }),
  ).toBe(true);

  expect(options()).toMatchObject({
    dsn: "https://key@o1.ingest.de.sentry.io/1",
    release: "finso@1.0.0",
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
  });
});

it("keeps only screen-to-screen breadcrumbs — taps and logs could carry amounts", () => {
  startMonitoring({ dsn: "https://key@o1.ingest.de.sentry.io/1", appVersion: "1.0.0" });
  const keep = options().beforeBreadcrumb;
  if (!keep) throw new Error("no beforeBreadcrumb");

  const navigation: Breadcrumb = { category: "navigation", data: { to: "/goals" } };
  expect(keep(navigation, {})).toEqual(navigation);
  expect(keep({ category: "touch", message: "Wpłać 200 zł" }, {})).toBeNull();
  expect(keep({ category: "console", message: "budget 4200" }, {})).toBeNull();
  expect(keep({ category: "fetch", data: { url: "https://api/goals" } }, {})).toBeNull();
});

it("strips the user, the request and extra data before a report leaves the phone", () => {
  startMonitoring({ dsn: "https://key@o1.ingest.de.sentry.io/1", appVersion: "1.0.0" });
  const scrub = options().beforeSend;
  if (!scrub) throw new Error("no beforeSend");

  const event: ErrorEvent = {
    type: undefined,
    message: "boom",
    user: { id: "u1", email: "ola@example.com", ip_address: "1.2.3.4" },
    request: { url: "https://api.finso.app/budget/current" },
    extra: { amount: 4200 },
    exception: { values: [{ type: "TypeError", value: "x is undefined" }] },
  };

  expect(scrub(event, {})).toEqual({
    type: undefined,
    message: "boom",
    exception: { values: [{ type: "TypeError", value: "x is undefined" }] },
  });
});
