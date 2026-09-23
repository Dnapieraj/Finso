/**
 * Data kalendarzowa w formacie "YYYY-MM-DD", bez komponentu czasu ani
 * strefy — dokładnie to, co Prisma trzyma jako `@db.Date` dla
 * Transaction.date / Goal.targetDate. Branded type, nie goły `string`.
 *
 * Celowo NIE ma tu `Date`/`Temporal` (Temporal nie jest jeszcze
 * stabilne w Node bez flagi). Cała arytmetyka kalendarzowa w tym
 * module operuje na już-rozstrzygniętych datach kalendarzowych, więc
 * może bezpiecznie liczyć w UTC (dzień to dzień, niezależnie od strefy
 * użytkownika) — problem zmiany czasu (DST) dotyczy WYŁĄCZNIE
 * momentu, w którym instant (np. `new Date()`) zamienia się na "jaki
 * dziś jest dzień dla tego użytkownika" — a to świadomie NIE jest
 * częścią tego modułu: silnik budżetu nigdy nie czyta zegara systemowego
 * (żadnych `new Date()`/`Date.now()` w środku), tylko dostaje `asOf`
 * jako jawny argument. Rozstrzygnięcie "co jest dziś w Europe/Warsaw"
 * to zadanie warstwy wywołującej (apps/api), nie silnika budżetu.
 */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

/**
 * Tworzy wartość typu {@link IsoDate}. Rzuca, jeśli `value` nie pasuje
 * do formatu YYYY-MM-DD albo nie jest realną datą kalendarzową
 * (np. "2024-02-30" albo "2023-02-29" w roku nieprzestępnym).
 */
export declare function isoDate(value: string): IsoDate;

/**
 * Liczba pełnych dni kalendarzowych między `from` a `to` (`to - from`).
 * Dodatnia, gdy `to` jest później. Poprawnie liczy przez lata przestępne
 * (arytmetyka na dniach juliańskich, nie na `Date` z lokalnym czasem).
 */
export declare function daysBetween(from: IsoDate, to: IsoDate): number;

/** Dodaje (lub odejmuje, dla ujemnego `days`) dni kalendarzowe do daty. */
export declare function addDays(date: IsoDate, days: number): IsoDate;

/** `a <= b` jako data kalendarzowa (proste porównanie leksykograficzne działa dla YYYY-MM-DD, ale nazwana funkcja czyta się lepiej w logice budżetu). */
export declare function isOnOrBefore(a: IsoDate, b: IsoDate): boolean;
