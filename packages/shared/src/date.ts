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

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDateParts(value: string): DateParts {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) {
    throw new TypeError(
      `Nieprawidłowy format daty: "${value}" (oczekiwano YYYY-MM-DD).`,
    );
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function toEpochDay({ year, month, day }: DateParts): number {
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function epochDayToIsoDate(epochDay: number): IsoDate {
  const date = new Date(epochDay * MS_PER_DAY);
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as IsoDate;
}

/**
 * Tworzy wartość typu {@link IsoDate}. Rzuca, jeśli `value` nie pasuje
 * do formatu YYYY-MM-DD albo nie jest realną datą kalendarzową
 * (np. "2024-02-30" albo "2023-02-29" w roku nieprzestępnym).
 */
export function isoDate(value: string): IsoDate {
  const parts = parseIsoDateParts(value);
  // Date.UTC normalizuje przepełnienia (np. dzień 30 lutego zamienia
  // w 1/2 marca) zamiast rzucać, więc sprawdzamy ręcznie, że to, co
  // wraca, zgadza się z tym, co podano — inaczej "2024-02-30" po cichu
  // stałoby się poprawną datą 1 marca.
  const roundTrip = epochDayToIsoDate(toEpochDay(parts));
  if (roundTrip !== value) {
    throw new TypeError(`Nieprawidłowa data kalendarzowa: "${value}".`);
  }
  return value as IsoDate;
}

/**
 * Liczba pełnych dni kalendarzowych między `from` a `to` (`to - from`).
 * Dodatnia, gdy `to` jest później. Poprawnie liczy przez lata przestępne
 * (arytmetyka na dniach epoki w UTC, nie na `Date` z lokalnym czasem).
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(parseIsoDateParts(to)) - toEpochDay(parseIsoDateParts(from));
}

/** Dodaje (lub odejmuje, dla ujemnego `days`) dni kalendarzowe do daty. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return epochDayToIsoDate(toEpochDay(parseIsoDateParts(date)) + days);
}

/** `a <= b` jako data kalendarzowa. */
export function isOnOrBefore(a: IsoDate, b: IsoDate): boolean {
  return a <= b;
}
