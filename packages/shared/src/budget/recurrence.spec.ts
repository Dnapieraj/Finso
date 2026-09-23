import { describe, expect, it } from 'vitest';

import { isoDate } from '../date.js';
import type { RecurrenceSchedule } from './recurrence.js';
import { occurrencesInPeriod } from './recurrence.js';
import type { BudgetPeriod } from './types.js';

const d = isoDate;
const period = (start: string, end: string): BudgetPeriod => ({ start: d(start), end: d(end) });
const september = period('2026-09-01', '2026-09-30');

const monthly = (dayOfMonth: number, overrides: Partial<RecurrenceSchedule> = {}): RecurrenceSchedule => ({
  frequency: 'MONTHLY',
  interval: 1,
  startDate: d('2026-01-01'),
  dayOfMonth,
  dayOfWeek: null,
  ...overrides,
});

const weekly = (dayOfWeek: number, overrides: Partial<RecurrenceSchedule> = {}): RecurrenceSchedule => ({
  frequency: 'WEEKLY',
  interval: 1,
  startDate: d('2026-01-01'),
  dayOfMonth: null,
  dayOfWeek,
  ...overrides,
});

describe('occurrencesInPeriod — MONTHLY', () => {
  it('jedno wystąpienie w miesiącu kalendarzowym', () => {
    expect(occurrencesInPeriod(monthly(10), september)).toEqual(['2026-09-10']);
  });

  it('granice okresu są włącznie', () => {
    expect(occurrencesInPeriod(monthly(1), september)).toEqual(['2026-09-01']);
    expect(occurrencesInPeriod(monthly(30), september)).toEqual(['2026-09-30']);
  });

  it('okres przez przełom miesięcy (10.09–09.10) wybiera właściwy miesiąc', () => {
    const p = period('2026-09-10', '2026-10-09');
    expect(occurrencesInPeriod(monthly(15), p)).toEqual(['2026-09-15']);
    expect(occurrencesInPeriod(monthly(5), p)).toEqual(['2026-10-05']);
    expect(occurrencesInPeriod(monthly(10), p)).toEqual(['2026-09-10']);
    expect(occurrencesInPeriod(monthly(9), p)).toEqual(['2026-10-09']);
  });

  it('kotwica 31. w 30-dniowym miesiącu → ostatni dzień miesiąca', () => {
    expect(occurrencesInPeriod(monthly(31), september)).toEqual(['2026-09-30']);
  });

  it('kotwica 31. w lutym roku zwykłego → 28.02', () => {
    expect(occurrencesInPeriod(monthly(31), period('2026-02-01', '2026-02-28'))).toEqual(['2026-02-28']);
  });

  it('kotwica 31. w lutym roku przestępnego → 29.02', () => {
    expect(occurrencesInPeriod(monthly(31), period('2028-02-01', '2028-02-29'))).toEqual(['2028-02-29']);
  });

  it('interval 2: co drugi miesiąc licząc od miesiąca startDate', () => {
    const everyOther = monthly(10, { interval: 2, startDate: d('2026-01-10') });
    // Styczeń, marzec, maj, lipiec, wrzesień...
    expect(occurrencesInPeriod(everyOther, september)).toEqual(['2026-09-10']);
    expect(occurrencesInPeriod(everyOther, period('2026-10-01', '2026-10-31'))).toEqual([]);
  });

  it('nic przed startDate', () => {
    expect(occurrencesInPeriod(monthly(10, { startDate: d('2026-10-01') }), september)).toEqual([]);
    // Start w trakcie okresu, ale po dniu płatności w tym miesiącu.
    expect(occurrencesInPeriod(monthly(10, { startDate: d('2026-09-15') }), september)).toEqual([]);
  });
});

describe('occurrencesInPeriod — WEEKLY', () => {
  it('co tydzień w piątek: 4 piątki we wrześniu 2026', () => {
    expect(occurrencesInPeriod(weekly(5), september)).toEqual([
      '2026-09-04',
      '2026-09-11',
      '2026-09-18',
      '2026-09-25',
    ]);
  });

  it('co 2 tygodnie: faza od pierwszego piątku po startDate', () => {
    // startDate wtorek 1.09 → pierwszy piątek 4.09, potem 18.09.
    const biweekly = weekly(5, { interval: 2, startDate: d('2026-09-01') });
    expect(occurrencesInPeriod(biweekly, september)).toEqual(['2026-09-04', '2026-09-18']);
  });

  it('co 2 tygodnie z fazą przesuniętą o tydzień', () => {
    const biweekly = weekly(5, { interval: 2, startDate: d('2026-08-28') });
    expect(occurrencesInPeriod(biweekly, september)).toEqual(['2026-09-11', '2026-09-25']);
  });
});

describe('occurrencesInPeriod — YEARLY', () => {
  const yearly = (startDate: string, dayOfMonth: number): RecurrenceSchedule => ({
    frequency: 'YEARLY',
    interval: 1,
    startDate: d(startDate),
    dayOfMonth,
    dayOfWeek: null,
  });

  it('raz w roku, w miesiącu startDate', () => {
    const insurance = yearly('2025-03-15', 15);
    expect(occurrencesInPeriod(insurance, period('2026-03-01', '2026-03-31'))).toEqual(['2026-03-15']);
    expect(occurrencesInPeriod(insurance, september)).toEqual([]);
  });

  it('kotwica 29.02 w roku zwykłym → 28.02', () => {
    const leapAnchor = yearly('2024-02-29', 29);
    expect(occurrencesInPeriod(leapAnchor, period('2026-02-01', '2026-02-28'))).toEqual(['2026-02-28']);
    expect(occurrencesInPeriod(leapAnchor, period('2028-02-01', '2028-02-29'))).toEqual(['2028-02-29']);
  });
});
