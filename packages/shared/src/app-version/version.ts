/** Wersja appki „major.minor.patch” — jak `version` w app.json. */
export const APP_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** Nagłówek, w którym appka podaje swoją wersję przy każdym żądaniu. */
export const APP_VERSION_HEADER = "X-App-Version";

function parts(version: string): [number, number, number] | null {
  const match = APP_VERSION_PATTERN.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * Czy `current` jest starsza niż `minimum` — liczbowo („0.9.10” < „0.10.0”).
 * Nieczytelna wersja nigdy nie jest „starsza”: błąd w nagłówku nie może
 * odciąć użytkownika od jego danych.
 */
export function isOlderVersion(current: string, minimum: string): boolean {
  const a = parts(current);
  const b = parts(minimum);
  if (!a || !b) return false;
  const [major, minor, patch] = a;
  const [minMajor, minMinor, minPatch] = b;
  if (major !== minMajor) return major < minMajor;
  if (minor !== minMinor) return minor < minMinor;
  return patch < minPatch;
}
