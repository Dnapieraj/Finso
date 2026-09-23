import { describe, expect, it } from 'vitest';

import { isoDate } from '../date.js';
import { currentBudgetPeriod, periodsUntil, todayInTimeZone } from './period.js';

const d = isoDate;

describe('todayInTimeZone', () => {
  it('zwykły dzień: Warszawa jest przed UTC', () => {
    // 31.08 22:30 UTC = 1.09 00:30 w Warszawie (CEST, UTC+2).
    expect(todayInTimeZone(new Date('2026-08-31T22:30:00Z'), 'Europe/Warsaw')).toBe('2026-09-01');
  });

  it('Nowy Jork jest za UTC — ten sam instant to jeszcze poprzedni dzień', () => {
    expect(todayInTimeZone(new Date('2026-09-23T03:00:00Z'), 'America/New_York')).toBe('2026-09-22');
  });

  describe('zmiana czasu (DST) w Europe/Warsaw', () => {
    it('noc zmiany na letni (29.03.2026): 00:30 i 01:30 lokalnie to ten sam dzień', () => {
      expect(todayInTimeZone(new Date('2026-03-28T23:30:00Z'), 'Europe/Warsaw')).toBe('2026-03-29');
      expect(todayInTimeZone(new Date('2026-03-29T00:30:00Z'), 'Europe/Warsaw')).toBe('2026-03-29');
    });

    it('wieczór po zmianie na letni: 22:30 UTC to już 30.03 (UTC+2, nie UTC+1)', () => {
      // Naiwne "Warszawa = UTC+1" dałoby 23:30 29.03 — dzienny limit
      // przeskoczyłby na nowy dzień godzinę za późno.
      expect(todayInTimeZone(new Date('2026-03-29T22:30:00Z'), 'Europe/Warsaw')).toBe('2026-03-30');
    });

    it('wieczór po zmianie na zimowy: 22:30 UTC to jeszcze 25.10 (UTC+1, nie UTC+2)', () => {
      expect(todayInTimeZone(new Date('2026-10-25T22:30:00Z'), 'Europe/Warsaw')).toBe('2026-10-25');
      expect(todayInTimeZone(new Date('2026-10-25T23:30:00Z'), 'Europe/Warsaw')).toBe('2026-10-26');
    });
  });
});

describe('currentBudgetPeriod', () => {
  it('periodStartDay = 1 → miesiąc kalendarzowy', () => {
    expect(currentBudgetPeriod(d('2026-09-23'), 1)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    });
  });

  it('dzień wypłaty 10., dziś po wypłacie → od 10. tego miesiąca do 9. następnego', () => {
    expect(currentBudgetPeriod(d('2026-09-23'), 10)).toEqual({
      start: '2026-09-10',
      end: '2026-10-09',
    });
  });

  it('dziś w dzień startu → nowy okres zaczyna się dziś', () => {
    expect(currentBudgetPeriod(d('2026-09-10'), 10).start).toBe('2026-09-10');
  });

  it('dziś przed dniem startu → okres zaczął się w poprzednim miesiącu', () => {
    expect(currentBudgetPeriod(d('2026-09-09'), 10)).toEqual({
      start: '2026-08-10',
      end: '2026-09-09',
    });
  });

  it('przełom roku: 5 stycznia przy starcie 10. → 10.12–09.01', () => {
    expect(currentBudgetPeriod(d('2027-01-05'), 10)).toEqual({
      start: '2026-12-10',
      end: '2027-01-09',
    });
  });

  it('rok przestępny: luty 2028 ma 29 dni', () => {
    expect(currentBudgetPeriod(d('2028-02-15'), 1)).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('start 28. przechodzi przez luty bez przycinania', () => {
    expect(currentBudgetPeriod(d('2026-03-01'), 28)).toEqual({
      start: '2026-02-28',
      end: '2026-03-27',
    });
  });
});

describe('periodsUntil', () => {
  // Okresy od 10.: [10.09–09.10], [10.10–09.11], ...
  const today = d('2026-09-23');

  it('termin w bieżącym okresie → 1', () => {
    expect(periodsUntil(today, d('2026-10-09'), 10)).toBe(1);
  });

  it('termin pierwszego dnia następnego okresu → 2', () => {
    expect(periodsUntil(today, d('2026-10-10'), 10)).toBe(2);
  });

  it('termin za pół roku → liczba okresów, które się do niego zaczną', () => {
    // Starty: 10.09, 10.10, 10.11, 10.12, 10.01, 10.02 — termin 15.02.
    expect(periodsUntil(today, d('2027-02-15'), 10)).toBe(6);
  });

  it('termin celu dziś → 1 (jeszcze można odłożyć)', () => {
    expect(periodsUntil(today, today, 10)).toBe(1);
  });

  it('termin celu w przeszłości (także w bieżącym okresie) → 0', () => {
    expect(periodsUntil(today, d('2026-09-15'), 10)).toBe(0);
    expect(periodsUntil(today, d('2025-01-01'), 10)).toBe(0);
  });
});
