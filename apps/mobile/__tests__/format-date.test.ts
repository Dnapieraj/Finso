import { formatDayMonth } from "../src/format/date";

// Own month names instead of Intl: Hermes on Android may ship without full
// Polish locale data, and web + tests + device must print the same text.
it.each([
  ["2026-01-05", "5 stycznia"],
  ["2026-02-28", "28 lutego"],
  ["2028-02-29", "29 lutego"],
  ["2026-03-01", "1 marca"],
  ["2026-04-10", "10 kwietnia"],
  ["2026-05-10", "10 maja"],
  ["2026-06-10", "10 czerwca"],
  ["2026-07-10", "10 lipca"],
  ["2026-08-10", "10 sierpnia"],
  ["2026-09-27", "27 września"],
  ["2026-10-10", "10 października"],
  ["2026-11-10", "10 listopada"],
  ["2026-12-31", "31 grudnia"],
])("%s → %s", (date, expected) => {
  expect(formatDayMonth(date)).toBe(expected);
});
