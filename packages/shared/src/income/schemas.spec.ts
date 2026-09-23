import { describe, expect, it } from 'vitest';

import {
  createIncomeEntrySchema,
  createIncomeSourceSchema,
  incomeSourceShapeSchema,
  updateIncomeEntrySchema,
} from './schemas.js';
import { createGoalSchema, updateGoalSchema } from '../goals/schemas.js';
import { createTransactionSchema, updateTransactionSchema } from '../transactions/schemas.js';
import { createCategorySchema } from '../categories/schemas.js';

const SOURCE_ID = '01a0cf55-89a0-7159-b809-6b5abf846e15';

describe('createIncomeSourceSchema', () => {
  it('REGULAR wymaga oczekiwanej kwoty', () => {
    expect(createIncomeSourceSchema.safeParse({ name: 'Pensja', kind: 'REGULAR' }).success).toBe(false);
    expect(
      createIncomeSourceSchema.safeParse({ name: 'Pensja', kind: 'REGULAR', expectedAmount: 800_000 })
        .success,
    ).toBe(true);
  });

  it('IRREGULAR nie może mieć oczekiwanej kwoty — prognozę liczy silnik', () => {
    expect(
      createIncomeSourceSchema.safeParse({ name: 'Zlecenia', kind: 'IRREGULAR', expectedAmount: 1 })
        .success,
    ).toBe(false);
    expect(createIncomeSourceSchema.safeParse({ name: 'Zlecenia', kind: 'IRREGULAR' }).success).toBe(
      true,
    );
  });

  it('incomeSourceShapeSchema sprawdza stan po scaleniu PATCH', () => {
    expect(incomeSourceShapeSchema.safeParse({ kind: 'IRREGULAR', expectedAmount: 500 }).success).toBe(
      false,
    );
  });
});

describe('domyślne wartości tylko przy tworzeniu', () => {
  it('nowy wpływ i wydatek są domyślnie CONFIRMED', () => {
    expect(
      createIncomeEntrySchema.parse({ incomeSourceId: SOURCE_ID, amount: 100, date: '2026-09-10' })
        .status,
    ).toBe('CONFIRMED');
    expect(createTransactionSchema.parse({ amount: 100, date: '2026-09-10' }).status).toBe('CONFIRMED');
  });

  it('PATCH nie nadpisuje statusu wartością domyślną', () => {
    expect(updateTransactionSchema.parse({ note: 'kawa' })).toEqual({ note: 'kawa' });
    expect(updateIncomeEntrySchema.parse({ amount: 100 })).toEqual({ amount: 100 });
  });

  it('nowy cel startuje od 0 odłożonych, PATCH tego nie zeruje', () => {
    const goal = { name: 'Wakacje', targetAmount: 500_000, targetDate: '2027-06-01' };
    expect(createGoalSchema.parse(goal).currentAmount).toBe(0);
    expect(updateGoalSchema.parse({ name: 'Urlop' })).toEqual({ name: 'Urlop' });
  });

  it('wpływowi nie da się zmienić źródła', () => {
    expect(updateIncomeEntrySchema.parse({ incomeSourceId: SOURCE_ID })).toEqual({});
  });
});

describe('createCategorySchema', () => {
  it('wymaga koloru w formacie #rrggbb', () => {
    const base = { name: 'Kawa', icon: 'coffee' };
    expect(createCategorySchema.safeParse({ ...base, color: '#a1b2c3' }).success).toBe(true);
    expect(createCategorySchema.safeParse({ ...base, color: 'red' }).success).toBe(false);
  });
});
