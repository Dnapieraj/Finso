import { describe, expect, it } from 'vitest';

import { budgetSummarySchema, simulatePurchaseRequestSchema, simulationResultSchema } from './schemas.js';

const CATEGORY_ID = '01a0cf55-89a0-7159-b809-6b5abf846e15';

describe('simulatePurchaseRequestSchema', () => {
  it('wymaga dodatniej kwoty w groszach i kategorii', () => {
    expect(simulatePurchaseRequestSchema.safeParse({ amount: 10_000, categoryId: CATEGORY_ID }).success).toBe(
      true,
    );
    expect(simulatePurchaseRequestSchema.safeParse({ amount: 10_000 }).success).toBe(false);
    expect(simulatePurchaseRequestSchema.safeParse({ amount: 0, categoryId: CATEGORY_ID }).success).toBe(false);
    expect(simulatePurchaseRequestSchema.safeParse({ amount: 99.5, categoryId: CATEGORY_ID }).success).toBe(
      false,
    );
  });
});

describe('budgetSummarySchema', () => {
  it('dopuszcza ujemne saldo i dzienny limit — użytkownik może być pod kreską', () => {
    const result = budgetSummarySchema.safeParse({
      period: { start: '2026-09-01', end: '2026-09-30' },
      asOf: '2026-09-23',
      availableBalance: -50_000,
      daysRemaining: 8,
      dailyAllowance: -6_250,
      breakdown: { periodIncome: 0, fixedCommitments: 0, goalContributions: 0, alreadySpent: 50_000 },
      fixedCommitments: [],
      goalContributions: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('simulationResultSchema', () => {
  it('przyjmuje tylko znane poziomy ryzyka', () => {
    const base = {
      canAfford: true,
      before: { availableBalance: 100, dailyAllowance: 10 },
      remainingAfter: 50,
      dailyAllowanceAfter: 5,
      goalImpacts: [],
    };
    expect(simulationResultSchema.safeParse({ ...base, riskLevel: 'tight' }).success).toBe(true);
    expect(simulationResultSchema.safeParse({ ...base, riskLevel: 'risky' }).success).toBe(false);
  });
});
