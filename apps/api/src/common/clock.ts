/**
 * Źródło "teraz" dla API. Wstrzykiwane (token CLOCK), a nie `new Date()`
 * w serwisie — tak jak silnik budżetu dostaje `asOf` z zewnątrz. Dzięki
 * temu testy e2e ustawiają konkretny moment (np. noc zmiany czasu)
 * zamiast zależeć od dnia, w którym ktoś je uruchomi.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };
