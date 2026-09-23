import { describe, expect, it } from "vitest";

import { contrastRatio, relativeLuminance } from "./contrast.ts";
import type { HexColor } from "./names.ts";

// Lets tests feed malformed strings past the HexColor type to hit the runtime guard.
const unchecked = (value: string) => value as HexColor;

describe("relativeLuminance", () => {
  it("is 0 for black and 1 for white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBe(1);
  });

  it("applies the sRGB gamma curve instead of averaging channels", () => {
    // Mid grey is ~21.6% luminance, not 50%.
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2159, 4);
  });

  it("uses the linear segment for very dark channels", () => {
    // 0x09 / 255 = 0.035 is below the 0.04045 threshold, so it is divided by
    // 12.92 instead of going through the power curve.
    expect(relativeLuminance("#090909")).toBeCloseTo(0.0027, 4);
  });

  it("weights green far more than blue", () => {
    expect(relativeLuminance("#00FF00")).toBeGreaterThan(
      relativeLuminance("#0000FF") * 9,
    );
  });

  it("accepts lowercase hex", () => {
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it.each(["#FFF", "FFFFFF", "#GGGGGG", "#FFFFFFFF", "red", ""])(
    "rejects %j",
    (value) => {
      expect(() => relativeLuminance(unchecked(value))).toThrow(RangeError);
    },
  );
});

describe("contrastRatio", () => {
  it("is 21 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 10);
  });

  it("is 1 for identical colors", () => {
    expect(contrastRatio("#3D5A2E", "#3D5A2E")).toBe(1);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#3D5A2E", "#F5F6F1")).toBe(
      contrastRatio("#F5F6F1", "#3D5A2E"),
    );
  });

  it("is not rounded, so a borderline grey fails AA", () => {
    // #777777 on white is the textbook near miss: 4.48:1.
    const ratio = contrastRatio("#777777", "#FFFFFF");
    expect(ratio).toBeCloseTo(4.48, 2);
    expect(ratio).toBeLessThan(4.5);
  });

  it("rejects malformed colors on either side", () => {
    expect(() => contrastRatio(unchecked("#FFF"), "#000000")).toThrow(
      RangeError,
    );
    expect(() => contrastRatio("#000000", unchecked("#FFF"))).toThrow(
      RangeError,
    );
  });
});
