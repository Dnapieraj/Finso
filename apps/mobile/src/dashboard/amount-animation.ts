/** Long enough to see the number move, short enough not to wait for it. */
export const AMOUNT_ANIMATION_MS = 600;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * The amount shown `elapsedMs` into an animation from `from` to `to`, in
 * whole grosze. Eases out, so the change reads at once and settles gently;
 * exactly `to` from the end on.
 *
 * @param input.from - The amount shown before the change, in grosze.
 * @param input.to - The new amount, in grosze.
 * @param input.elapsedMs - Time since the animation started.
 * @param input.durationMs - How long the whole animation takes.
 */
export function amountAt(input: {
  from: number;
  to: number;
  elapsedMs: number;
  durationMs: number;
}): number {
  const { from, to, elapsedMs, durationMs } = input;
  if (elapsedMs >= durationMs) return to;
  const progress = easeOutCubic(Math.max(0, elapsedMs) / durationMs);
  return Math.round(from + (to - from) * progress);
}

/**
 * Whether going from one amount to another is worth animating. Not when
 * nothing changed, and not across zero: "Możesz wydać" turns into "Jesteś
 * pod kreską o" at once, and digits counting through zero under the new
 * words would say something false.
 */
export function shouldAnimateAmount(from: number, to: number): boolean {
  return from !== to && from < 0 === to < 0;
}
