// Genitive month names ("10 października"). Own table instead of Intl:
// Hermes on Android may ship without Polish locale data, and the tests,
// the device and the web must all print the same text.
const MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
] as const;

/** `"2026-10-10"` → `"10 października"`. Takes a calendar date, not a timestamp. */
export function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${String(day)} ${MONTHS[(month ?? 1) - 1] ?? ""}`;
}
