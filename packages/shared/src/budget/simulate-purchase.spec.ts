import { describe, expect, it } from 'vitest';

import { isoDate } from '../date.js';
import { grosze } from '../money.js';
import type { SimulatePurchaseInput } from './types.js';
import { simulatePurchase } from './simulate-purchase.js';

/**
 * Bazowy stan budżetu (bez zakupu): availableBalance = 500000 - 100000
 * (wkład w cel g1) = 400000, na 30 dni (1-30 września) ->
 * dailyAllowance = floor(400000 / 30) = 13333.
 */
function baseInput(): SimulatePurchaseInput {
  return {
    periodIncome: grosze(500_000),
    period: { start: isoDate('2026-09-01'), end: isoDate('2026-09-30') },
    asOf: isoDate('2026-09-01'),
    remainingFixedCommitments: [],
    goalContributions: [{ goalId: 'g1', amount: grosze(100_000) }],
    alreadySpent: grosze(0),
    goals: [
      {
        id: 'g1',
        targetAmount: grosze(1_200_000),
        currentAmount: grosze(0),
        // 365 dni od asOf (2026-09-01 -> 2027-09-01, bez 29 lutego po drodze).
        targetDate: isoDate('2027-09-01'),
      },
    ],
  };
}

describe('simulatePurchase', () => {
  it('mały zakup: stać, riskLevel "safe"', () => {
    const result = simulatePurchase(baseInput(), grosze(10_000), 'cat-food');

    expect(result.canAfford).toBe(true);
    expect(result.remainingAfter).toBe(390_000); // 400000 - 10000
    expect(result.dailyAllowanceAfter).toBe(13_000); // floor(390000/30)
    expect(result.riskLevel).toBe('safe');
  });

  it('duży, ale możliwy zakup: dzienny budżet spada o >50% -> riskLevel "tight"', () => {
    const result = simulatePurchase(baseInput(), grosze(250_000), 'cat-food');

    expect(result.canAfford).toBe(true);
    expect(result.remainingAfter).toBe(150_000); // 400000 - 250000
    expect(result.dailyAllowanceAfter).toBe(5_000); // floor(150000/30)
    // 5000 / 13333 ≈ 0.375 < 0.5 (domyślny próg) -> tight
    expect(result.riskLevel).toBe('tight');
  });

  it('zakup przekraczający budżet: canAfford false, riskLevel "over"', () => {
    const result = simulatePurchase(baseInput(), grosze(450_000), 'cat-food');

    expect(result.canAfford).toBe(false);
    expect(result.remainingAfter).toBe(-50_000); // 400000 - 450000
    // floor(-50000 / 30) = floor(-1666.67) = -1667
    expect(result.dailyAllowanceAfter).toBe(-1_667);
    expect(result.riskLevel).toBe('over');
  });

  it('brzeg: zerowy dochód -> od razu "over" dla jakiegokolwiek zakupu', () => {
    const input = baseInput();
    input.periodIncome = grosze(0);
    input.goalContributions = [];

    const result = simulatePurchase(input, grosze(1), 'cat-food');

    expect(result.canAfford).toBe(false);
    expect(result.riskLevel).toBe('over');
  });

  it('respektuje własny tightThresholdRatio zamiast domyślnych 0.5', () => {
    const input = baseInput();
    // remainingAfter = 400000 - 50000 = 350000, dailyAllowanceAfter =
    // floor(350000/30) = 11666. 11666/13333 ≈ 0.875.
    const withDefault = simulatePurchase(input, grosze(50_000), 'cat-food');
    expect(withDefault.riskLevel).toBe('safe'); // 0.875 >= 0.5

    input.tightThresholdRatio = 0.9;
    const withCustomThreshold = simulatePurchase(
      input,
      grosze(50_000),
      'cat-food',
    );
    expect(withCustomThreshold.riskLevel).toBe('tight'); // 0.875 < 0.9
  });

  it('categoryId nie wpływa na wynik (MVP nie ma limitów per kategoria)', () => {
    const a = simulatePurchase(baseInput(), grosze(50_000), 'cat-food');
    const b = simulatePurchase(baseInput(), grosze(50_000), 'cat-transport');

    expect(a).toEqual(b);
  });

  describe('goalImpacts', () => {
    it('bez deficytu (stać na zakup) — żaden cel się nie opóźnia', () => {
      const result = simulatePurchase(baseInput(), grosze(10_000), 'cat-food');

      expect(result.goalImpacts).toEqual([{ goalId: 'g1', delayDays: 0 }]);
    });

    it('deficyt opóźnia cel proporcjonalnie do jego własnego tempa oszczędzania', () => {
      // amount 450000 -> deficyt 50000 (patrz test "over" wyżej).
      // g1: brakuje 1200000, 365 dni do terminu -> tempo ≈ 3287.67/dzień.
      // ceil(50000 / 3287.67) = ceil(15.21) = 16.
      const result = simulatePurchase(baseInput(), grosze(450_000), 'cat-food');

      expect(result.goalImpacts).toEqual([{ goalId: 'g1', delayDays: 16 }]);
    });

    it('deficyt większy niż wkład zaplanowany na cel w tym okresie — capped na wkładzie', () => {
      const input = baseInput();
      input.goalContributions = [{ goalId: 'g1', amount: grosze(10_000) }];
      // availableBalance = 500000 - 10000 = 490000. Zakup 600000 ->
      // remainingAfter = -110000 -> deficyt 110000, ale wkład na g1 w tym
      // okresie to tylko 10000, więc affectedAmount = min(110000, 10000) = 10000.
      // ceil(10000 / 3287.67) = ceil(3.04) = 4.
      const result = simulatePurchase(input, grosze(600_000), 'cat-food');

      expect(result.goalImpacts).toEqual([{ goalId: 'g1', delayDays: 4 }]);
    });

    it('cel już osiągnięty — delayDays 0, nawet przy deficycie', () => {
      const input = baseInput();
      input.goals = [
        {
          id: 'g1',
          targetAmount: grosze(50_000),
          currentAmount: grosze(50_000),
          targetDate: isoDate('2027-09-01'),
        },
      ];

      const result = simulatePurchase(input, grosze(450_000), 'cat-food');

      expect(result.goalImpacts).toEqual([{ goalId: 'g1', delayDays: 0 }]);
    });

    it('termin celu w przeszłości — delayDays 0 (nie da się liczyć względem terminu, który już minął)', () => {
      const input = baseInput();
      input.goals = [
        {
          id: 'g1',
          targetAmount: grosze(1_200_000),
          currentAmount: grosze(0),
          targetDate: isoDate('2026-08-01'), // przed asOf (2026-09-01)
        },
      ];

      const result = simulatePurchase(input, grosze(450_000), 'cat-food');

      expect(result.goalImpacts).toEqual([{ goalId: 'g1', delayDays: 0 }]);
    });

    it('wiele celów liczone NIEZALEŻNIE (nie proporcjonalny rozkład deficytu między nimi)', () => {
      const input = baseInput();
      input.goalContributions = [
        { goalId: 'g1', amount: grosze(100_000) },
        { goalId: 'g2', amount: grosze(80_000) },
      ];
      input.goals = [
        {
          id: 'g1',
          targetAmount: grosze(1_200_000),
          currentAmount: grosze(0),
          targetDate: isoDate('2027-09-01'), // 365 dni, tempo ≈ 3287.67/dzień
        },
        {
          id: 'g2',
          targetAmount: grosze(600_000),
          currentAmount: grosze(100_000),
          targetDate: isoDate('2027-03-01'), // 181 dni, tempo ≈ 2762.43/dzień
        },
      ];
      // periodIncome 500000 - 100000 - 80000 = 320000 dostępne przed zakupem.
      // Zakup 450000 -> remainingAfter = 320000 - 450000 = -130000 -> deficyt
      // 130000, capped przy każdym celu osobno do jego WŁASNEGO wkładu
      // w tym okresie (nie sumy): g1 -> min(130000,100000)=100000,
      // g2 -> min(130000,80000)=80000. Gdyby to był proporcjonalny
      // rozkład tego samego 130000 na oba cele, liczby wyszłyby inne —
      // to jest właśnie test na to, że liczymy je niezależnie.
      // g1: ceil(100000 / 3287.67) = ceil(30.42) = 31
      // g2: ceil(80000 / 2762.43) = ceil(28.96) = 29
      const result = simulatePurchase(input, grosze(450_000), 'cat-food');

      expect(result.goalImpacts).toEqual(
        expect.arrayContaining([
          { goalId: 'g1', delayDays: 31 },
          { goalId: 'g2', delayDays: 29 },
        ]),
      );
      expect(result.goalImpacts).toHaveLength(2);
    });
  });
});
