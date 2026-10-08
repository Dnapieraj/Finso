import { LOCK_AFTER_MS, shouldLockOnReturn } from "../src/lock/policy";

const at = (seconds: number) => new Date(2026, 9, 8, 12, 0, seconds).getTime();

describe("shouldLockOnReturn — po jakim czasie w tle appka prosi o odblokowanie", () => {
  it("próg to 1 minuta", () => {
    expect(LOCK_AFTER_MS).toBe(60_000);
  });

  it("krótki powrót (wklejenie kodu, zdjęcie paragonu) nie blokuje", () => {
    expect(shouldLockOnReturn({ backgroundedAt: at(0), now: at(30) })).toBe(false);
    expect(shouldLockOnReturn({ backgroundedAt: at(0), now: at(0) + 59_999 })).toBe(false);
  });

  it("od pełnej minuty blokuje", () => {
    expect(shouldLockOnReturn({ backgroundedAt: at(0), now: at(60) })).toBe(true);
    expect(shouldLockOnReturn({ backgroundedAt: at(0), now: at(0) + 3_600_000 })).toBe(true);
  });

  it("zegar cofnięty w tle (zmiana strefy, ręczna zmiana czasu) blokuje — w razie wątpliwości bezpieczniej", () => {
    expect(shouldLockOnReturn({ backgroundedAt: at(30), now: at(0) })).toBe(true);
  });

  it("bez zapisanej chwili zejścia do tła (np. pierwszy start) nie blokuje — start ma osobną regułę", () => {
    expect(shouldLockOnReturn({ backgroundedAt: null, now: at(0) })).toBe(false);
  });
});
