import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, isOnOrBefore, isoDate } from './date.js';

describe('isoDate', () => {
  it('przyjmuje poprawną datę', () => {
    expect(isoDate('2026-09-23')).toBe('2026-09-23');
  });

  it('rzuca dla złego formatu (bez zer wiodących)', () => {
    expect(() => isoDate('2026-9-23')).toThrow();
  });

  it('rzuca dla nieistniejącego dnia (30 lutego)', () => {
    expect(() => isoDate('2024-02-30')).toThrow();
  });

  it('rzuca dla 29 lutego w roku NIE przestępnym', () => {
    expect(() => isoDate('2023-02-29')).toThrow();
  });

  it('przyjmuje 29 lutego w roku przestępnym', () => {
    expect(isoDate('2024-02-29')).toBe('2024-02-29');
  });
});

describe('daysBetween', () => {
  it('zwraca 0 dla tej samej daty', () => {
    expect(daysBetween(isoDate('2026-01-01'), isoDate('2026-01-01'))).toBe(0);
  });

  it('liczy dodatnio, gdy `to` jest później', () => {
    expect(daysBetween(isoDate('2026-01-01'), isoDate('2026-01-02'))).toBe(1);
  });

  it('liczy ujemnie, gdy `to` jest wcześniej', () => {
    expect(daysBetween(isoDate('2026-01-02'), isoDate('2026-01-01'))).toBe(-1);
  });

  it('poprawnie liczy przez 29 lutego w roku przestępnym (2024)', () => {
    // 28 lutego -> 1 marca w roku przestępnym: 28., 29. lutego, 1. marca = 2 dni różnicy.
    expect(daysBetween(isoDate('2024-02-28'), isoDate('2024-03-01'))).toBe(2);
  });

  it('poprawnie liczy przez luty w roku NIE przestępnym (2023) — o jeden dzień mniej', () => {
    expect(daysBetween(isoDate('2023-02-28'), isoDate('2023-03-01'))).toBe(1);
  });

  it('poprawnie liczy przez zmianę czasu na letni w Polsce (29.03.2026) — czysta arytmetyka kalendarzowa, "brakująca godzina" tego dnia nie wpływa na liczbę dni', () => {
    expect(daysBetween(isoDate('2026-03-27'), isoDate('2026-03-31'))).toBe(4);
  });

  it('poprawnie liczy przez zmianę czasu na zimowy w Polsce (25.10.2026)', () => {
    expect(daysBetween(isoDate('2026-10-23'), isoDate('2026-10-27'))).toBe(4);
  });
});

describe('addDays', () => {
  it('dodaje dni w obrębie miesiąca', () => {
    expect(addDays(isoDate('2026-09-23'), 7)).toBe('2026-09-30');
  });

  it('przechodzi przez granicę roku', () => {
    expect(addDays(isoDate('2026-12-28'), 5)).toBe('2027-01-02');
  });

  it('przechodzi przez 29 lutego w roku przestępnym', () => {
    expect(addDays(isoDate('2024-02-27'), 3)).toBe('2024-03-01');
  });

  it('odejmuje dni dla ujemnego `days`', () => {
    expect(addDays(isoDate('2026-01-01'), -1)).toBe('2025-12-31');
  });

  it('z days = 0 zwraca tę samą datę', () => {
    expect(addDays(isoDate('2026-09-23'), 0)).toBe('2026-09-23');
  });
});

describe('isOnOrBefore', () => {
  it('true, gdy a jest wcześniej', () => {
    expect(isOnOrBefore(isoDate('2026-01-01'), isoDate('2026-01-02'))).toBe(
      true,
    );
  });

  it('true, gdy a i b są równe', () => {
    expect(isOnOrBefore(isoDate('2026-01-01'), isoDate('2026-01-01'))).toBe(
      true,
    );
  });

  it('false, gdy a jest później', () => {
    expect(isOnOrBefore(isoDate('2026-01-02'), isoDate('2026-01-01'))).toBe(
      false,
    );
  });
});
