import { describe, expect, it } from 'vitest';

import { amountSchema, cursorPageQuerySchema, INT4_MAX, isoDateInputSchema } from './schemas.js';
import { isValidTimeZone, updateMeSchema } from '../users/schemas.js';

describe('amountSchema', () => {
  it('przyjmuje dodatnie grosze do granicy int4', () => {
    expect(amountSchema.safeParse(1).success).toBe(true);
    expect(amountSchema.safeParse(INT4_MAX).success).toBe(true);
  });

  it('odrzuca zero, ujemne, ułamki i wartości ponad int4', () => {
    for (const value of [0, -100, 12.5, INT4_MAX + 1]) {
      expect(amountSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('isoDateInputSchema', () => {
  it('przyjmuje 29 lutego w roku przestępnym', () => {
    expect(isoDateInputSchema.parse('2024-02-29')).toBe('2024-02-29');
  });

  it('odrzuca 29 lutego w roku nieprzestępnym i daty z czasem', () => {
    expect(isoDateInputSchema.safeParse('2025-02-29').success).toBe(false);
    expect(isoDateInputSchema.safeParse('2026-09-01T00:00:00Z').success).toBe(false);
  });
});

describe('cursorPageQuerySchema', () => {
  it('parsuje limit z query stringa i ma domyślną wartość', () => {
    expect(cursorPageQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(cursorPageQuerySchema.parse({}).limit).toBe(50);
  });

  it('nie pozwala pobrać więcej niż 100 elementów naraz', () => {
    expect(cursorPageQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});

describe('updateMeSchema', () => {
  it('przyjmuje strefę IANA i dzień startu okresu 1-28', () => {
    expect(updateMeSchema.safeParse({ timezone: 'America/New_York', periodStartDay: 28 }).success).toBe(
      true,
    );
  });

  it('odrzuca nieznaną strefę i dzień 29+ (luty by go nie miał)', () => {
    expect(updateMeSchema.safeParse({ timezone: 'Mars/Olympus' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ periodStartDay: 29 }).success).toBe(false);
    expect(updateMeSchema.safeParse({ periodStartDay: 0 }).success).toBe(false);
  });

  it('isValidTimeZone akceptuje UTC', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
  });
});
