import type { IsoDate } from '@vireo/shared';
import { isoDate } from '@vireo/shared';

// Kolumny `@db.Date` Prisma zwraca jako Date o północy UTC. Konwersja
// przez UTC (a nie lokalny czas serwera) jest tu poprawna, bo to data
// kalendarzowa, nie moment — patrz komentarz przy Transaction.date.

/** `@db.Date` z bazy → "YYYY-MM-DD". */
export function toIsoDate(date: Date): IsoDate {
  return isoDate(date.toISOString().slice(0, 10));
}

/** "YYYY-MM-DD" → wartość do zapisu w kolumnie `@db.Date`. */
export function fromIsoDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
