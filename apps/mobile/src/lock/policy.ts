/**
 * How long the app may stay in the background before it asks to be
 * unlocked again: long enough to copy a code from an SMS or photograph a
 * receipt, short enough that a phone left on a table is locked.
 */
export const LOCK_AFTER_MS = 60_000;

/**
 * Whether coming back to the front needs an unlock. A clock that moved
 * backwards (time zone, manual change) locks: when unsure, the safe answer.
 */
export function shouldLockOnReturn({
  backgroundedAt,
  now,
}: {
  /** When the app went to the background; null if it never did. */
  backgroundedAt: number | null;
  now: number;
}): boolean {
  if (backgroundedAt === null) return false;
  const away = now - backgroundedAt;
  return away < 0 || away >= LOCK_AFTER_MS;
}
