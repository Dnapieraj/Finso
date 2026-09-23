import type { HexColor } from "./names.ts";

/**
 * Relative luminance of a color as defined by WCAG 2.2 (0 = black, 1 = white).
 *
 * @throws {RangeError} when `color` is not a `#RRGGBB` string.
 */
export declare function relativeLuminance(color: HexColor): number;

/**
 * WCAG 2.2 contrast ratio between two colors, from 1 (identical) to 21
 * (black on white). Order of arguments does not matter. The value is not
 * rounded, so 4.499 correctly fails a 4.5 requirement.
 *
 * @throws {RangeError} when either color is not a `#RRGGBB` string.
 */
export declare function contrastRatio(a: HexColor, b: HexColor): number;
