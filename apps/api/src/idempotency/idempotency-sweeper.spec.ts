import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdempotencySweeper, PURGE_INTERVAL_MS } from "./idempotency-sweeper.js";
import type { IdempotencyService } from "./idempotency.service.js";

function setup(purgeExpired = vi.fn(() => Promise.resolve(0))) {
  const sweeper = new IdempotencySweeper({ purgeExpired } as unknown as IdempotencyService);
  return { sweeper, purgeExpired };
}

describe("IdempotencySweeper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sprząta co godzinę", () => {
    expect(PURGE_INTERVAL_MS).toBe(60 * 60 * 1000);
  });

  it("sprząta od razu po starcie aplikacji, a potem co godzinę", async () => {
    const { sweeper, purgeExpired } = setup();

    sweeper.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(purgeExpired).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PURGE_INTERVAL_MS);
    expect(purgeExpired).toHaveBeenCalledTimes(2);

    sweeper.onApplicationShutdown();
  });

  it("przestaje sprzątać po zamknięciu aplikacji", async () => {
    const { sweeper, purgeExpired } = setup();
    sweeper.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);

    sweeper.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(3 * PURGE_INTERVAL_MS);

    expect(purgeExpired).toHaveBeenCalledTimes(1);
  });

  it("błąd sprzątania (np. chwilowo brak bazy) nie wywraca API; próbuje znowu za godzinę", async () => {
    const purgeExpired = vi
      .fn(() => Promise.resolve(0))
      .mockRejectedValueOnce(new Error("connection refused"));
    const { sweeper } = setup(purgeExpired);

    sweeper.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(PURGE_INTERVAL_MS);

    expect(purgeExpired).toHaveBeenCalledTimes(2);
    sweeper.onApplicationShutdown();
  });
});
