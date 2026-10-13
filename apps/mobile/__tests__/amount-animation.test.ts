import { amountAt, shouldAnimateAmount } from "../src/dashboard/amount-animation";

const DURATION = 600;

describe("amountAt — the value shown at a moment of the animation", () => {
  it("starts at the old amount and ends exactly at the new one", () => {
    expect(amountAt({ from: 123_456, to: 118_866, elapsedMs: 0, durationMs: DURATION })).toBe(
      123_456,
    );
    expect(
      amountAt({ from: 123_456, to: 118_866, elapsedMs: DURATION, durationMs: DURATION }),
    ).toBe(118_866);
  });

  it("after the end stays at the new amount (a late frame does not overshoot)", () => {
    expect(amountAt({ from: 0, to: 10_000, elapsedMs: 5_000, durationMs: DURATION })).toBe(10_000);
  });

  it("whole grosze in every frame, moving one way only", () => {
    const frames = Array.from({ length: 40 }, (_, i) =>
      amountAt({ from: 123_456, to: 118_866, elapsedMs: i * 16, durationMs: DURATION }),
    );

    for (const value of frames) expect(Number.isInteger(value)).toBe(true);
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]).toBeLessThanOrEqual(frames[i - 1] ?? Infinity);
    }
    expect(frames.at(-1)).toBe(118_866);
  });

  it("eases out: most of the way is done in the first half", () => {
    const half = amountAt({ from: 0, to: 10_000, elapsedMs: DURATION / 2, durationMs: DURATION });

    expect(half).toBeGreaterThan(5_000);
    expect(half).toBeLessThan(10_000);
  });

  it("grows as well as shrinks (an undone expense, a confirmed income)", () => {
    const mid = amountAt({ from: 100, to: 200, elapsedMs: DURATION / 2, durationMs: DURATION });

    expect(mid).toBeGreaterThan(100);
    expect(mid).toBeLessThan(200);
  });
});

describe("shouldAnimateAmount", () => {
  it("a change on the same side of zero animates", () => {
    expect(shouldAnimateAmount(123_456, 118_866)).toBe(true);
    expect(shouldAnimateAmount(-500, -1_500)).toBe(true);
  });

  it("no change, no animation", () => {
    expect(shouldAnimateAmount(123_456, 123_456)).toBe(false);
  });

  // Crossing zero swaps "Możesz wydać" for "Jesteś pod kreską o": a number
  // counting through zero under a label that already changed would mislead.
  it("crossing zero jumps straight to the new amount", () => {
    expect(shouldAnimateAmount(1_000, -500)).toBe(false);
    expect(shouldAnimateAmount(-500, 1_000)).toBe(false);
    expect(shouldAnimateAmount(0, -1)).toBe(false);
  });
});
