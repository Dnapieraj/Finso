import type { HexColor } from "./names.ts";

const HEX = /^#[0-9a-f]{6}$/i;

/** Converts one 0–255 sRGB channel to linear light, per WCAG 2.2. */
function linearize(channel: number): number {
  const c = channel / 255;
  // Below the threshold the sRGB curve is a straight line, not a power curve.
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance of a color as defined by WCAG 2.2 (0 = black, 1 = white).
 *
 * @throws {RangeError} when `color` is not a `#RRGGBB` string.
 */
export function relativeLuminance(color: HexColor): number {
  if (!HEX.test(color)) {
    throw new RangeError(`Expected a #RRGGBB color, got "${color}"`);
  }
  const channel = (start: number) => linearize(Number.parseInt(color.slice(start, start + 2), 16));
  // Weights reflect how sensitive the eye is to each primary.
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * WCAG 2.2 contrast ratio between two colors, from 1 (identical) to 21
 * (black on white). Order of arguments does not matter. The value is not
 * rounded, so 4.499 correctly fails a 4.5 requirement.
 *
 * @throws {RangeError} when either color is not a `#RRGGBB` string.
 */
export function contrastRatio(a: HexColor, b: HexColor): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  // The 0.05 offset models ambient light reflecting off the screen.
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
