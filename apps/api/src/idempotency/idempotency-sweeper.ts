import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import { Injectable, Logger } from "@nestjs/common";

import { IdempotencyService } from "./idempotency.service.js";

/** Co ile API usuwa wygasłe klucze: odpowiedź żyje najwyżej 24 h + 1 h. */
export const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Sprząta wygasłe klucze wszystkich użytkowników — także tych, którzy
 * przestali korzystać z appki, więc ich klucze nie zniknęłyby przy zapisie.
 * Zwykły timer zamiast biblioteki do crona: jedna operacja co godzinę.
 */
@Injectable()
export class IdempotencySweeper implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(IdempotencySweeper.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly idempotency: IdempotencyService) {}

  onApplicationBootstrap(): void {
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), PURGE_INTERVAL_MS);
    // Timer nie trzyma procesu przy życiu (testy, zamykanie).
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async sweep(): Promise<void> {
    try {
      await this.idempotency.purgeExpired();
    } catch (error) {
      // Chwilowy brak bazy nie może wywrócić API; kolejna próba za godzinę.
      this.logger.warn(`Sprzątanie kluczy idempotencji nie powiodło się: ${String(error)}`);
    }
  }
}
