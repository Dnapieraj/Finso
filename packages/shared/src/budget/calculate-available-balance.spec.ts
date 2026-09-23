import { describe, expect, it } from 'vitest';

import { isoDate } from '../date.js';
import { grosze } from '../money.js';
import { calculateAvailableBalance } from './calculate-available-balance.js';

describe('calculateAvailableBalance', () => {
  it('odejmuje zobowiązania, cele i wydatki od dochodu okresu', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(500_000),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-30') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [{ label: 'Czynsz', amount: grosze(120_000) }],
      goalContributions: [{ goalId: 'g1', amount: grosze(50_000) }],
      alreadySpent: grosze(80_000),
    });

    // 500000 - 120000 - 50000 - 80000 = 250000
    expect(result.availableBalance).toBe(250_000);
    // 1 września do 30 września włącznie = 30 dni
    expect(result.daysRemaining).toBe(30);
    // floor(250000 / 30) = floor(8333.33) = 8333
    expect(result.dailyAllowance).toBe(8_333);
    expect(result.breakdown).toEqual({
      periodIncome: 500_000,
      fixedCommitments: 120_000,
      goalContributions: 50_000,
      alreadySpent: 80_000,
    });
  });

  it('sumuje wiele zobowiązań i wiele linii wkładu w cele', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(1_000_000),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-10') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [
        { label: 'Czynsz', amount: grosze(100_000) },
        { label: 'Internet', amount: grosze(6_000) },
      ],
      goalContributions: [
        { goalId: 'g1', amount: grosze(20_000) },
        { goalId: 'g2', amount: grosze(15_000) },
      ],
      alreadySpent: grosze(0),
    });

    expect(result.breakdown.fixedCommitments).toBe(106_000);
    expect(result.breakdown.goalContributions).toBe(35_000);
  });

  it('brzeg: zerowy dochód daje ujemny bilans, gdy cokolwiek wydano', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-01') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(10_000),
    });

    expect(result.availableBalance).toBe(-10_000);
    expect(result.daysRemaining).toBe(1);
    expect(result.dailyAllowance).toBe(-10_000);
  });

  it('brzeg: ujemne saldo — dailyAllowance liczone floor(), nie zaniża deficytu', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-03') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(100),
    });

    expect(result.availableBalance).toBe(-100);
    expect(result.daysRemaining).toBe(3);
    // floor(-100 / 3) = floor(-33.33) = -34, NIE -33 (Math.trunc dałoby -33 —
    // to byłoby zaniżenie deficytu, niedozwolone).
    expect(result.dailyAllowance).toBe(-34);
  });

  it('brzeg: dodatnie saldo niepodzielne równo przez dni — floor(), nie round()', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(100),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-03') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    // floor(100 / 3) = floor(33.33) = 33, nie 34 (round) ani 33.33.
    expect(result.dailyAllowance).toBe(33);
  });

  it('brzeg: okres kończący się dziś — dzisiaj liczy się jako 1 dzień, nie 0', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(1_000),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-10') },
      asOf: isoDate('2026-09-10'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    expect(result.daysRemaining).toBe(1);
    expect(result.dailyAllowance).toBe(1_000);
  });

  it('brzeg: asOf przed period.start — daysRemaining to cały okres, nie okres + dni sprzed startu', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2026-09-05'), end: isoDate('2026-09-10') },
      asOf: isoDate('2026-09-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    // 5-10 września włącznie = 6 dni. Gdyby liczyć od asOf (01.09) zamiast
    // od period.start, wyszłoby 10 dni — źle, okres jeszcze się nie zaczął.
    expect(result.daysRemaining).toBe(6);
  });

  it('brzeg: okres już się skończył (asOf po period.end) — 0 dni, 0 dziennie, niezależnie od salda', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(1_000),
      period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-10') },
      asOf: isoDate('2026-09-11'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    expect(result.availableBalance).toBe(1_000);
    expect(result.daysRemaining).toBe(0);
    expect(result.dailyAllowance).toBe(0);
  });

  it('brzeg: rok przestępny — luty 2024 ma 29 dni', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2024-02-01'), end: isoDate('2024-03-01') },
      asOf: isoDate('2024-02-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    // 1-29 lutego (29 dni) + 1 marca = 30 dni.
    expect(result.daysRemaining).toBe(30);
  });

  it('brzeg: ten sam okres w roku NIE przestępnym ma o dzień mniej', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2023-02-01'), end: isoDate('2023-03-01') },
      asOf: isoDate('2023-02-01'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    expect(result.daysRemaining).toBe(29);
  });

  it('brzeg: okres obejmujący zmianę czasu na letni (29.03.2026) liczy dni poprawnie', () => {
    const result = calculateAvailableBalance({
      periodIncome: grosze(0),
      period: { start: isoDate('2026-03-27'), end: isoDate('2026-03-31') },
      asOf: isoDate('2026-03-27'),
      remainingFixedCommitments: [],
      goalContributions: [],
      alreadySpent: grosze(0),
    });

    // 27, 28, 29 (zmiana czasu), 30, 31 marca = 5 dni. "Brakująca" godzina
    // nocy z 28 na 29 marca nie ma prawa zmienić liczby dni w okresie.
    expect(result.daysRemaining).toBe(5);
  });
});
