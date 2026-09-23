import { describe, expect, it } from 'vitest';

import { excludeDeleted, toSoftDelete } from './soft-delete.extension.js';

// Testy samej logiki filtrowania/konwersji, bez żywego PrismaClient —
// $extends() wymaga prawdziwego klienta (i połączenia z bazą, żeby
// cokolwiek wykonać), więc pełny test integracyjny wjeżdża w etapie API
// razem z realnymi endpointami (e2e Supertest na /transactions,
// weryfikujący że skasowana transakcja znika też z sumy budżetu).
// To, co da się i trzeba przetestować bez bazy, to właśnie te dwie
// czyste funkcje — one decydują, czy soft-delete faktycznie działa.

describe('excludeDeleted', () => {
  it('dokłada deletedAt: null do pustego where', () => {
    expect(excludeDeleted(undefined)).toEqual({ deletedAt: null });
  });

  it('zachowuje istniejące warunki where', () => {
    expect(excludeDeleted({ userId: 'user-1' })).toEqual({
      userId: 'user-1',
      deletedAt: null,
    });
  });

  it('nadpisuje deletedAt, nawet jeśli wywołujący próbował je ustawić inaczej', () => {
    // To jest sedno gwarancji: nikt (nawet przez pomyłkę) nie przemyci
    // zapytania widzącego skasowane rekordy przez własny where.deletedAt.
    expect(
      excludeDeleted({ userId: 'user-1', deletedAt: { not: null } }),
    ).toEqual({ userId: 'user-1', deletedAt: null });
  });
});

describe('toSoftDelete', () => {
  it('zamienia where na argumenty update z deletedAt = teraz', () => {
    const before = Date.now();
    const result = toSoftDelete({ id: 'tx-1' });
    const after = Date.now();

    expect(result.where).toEqual({ id: 'tx-1' });
    expect(result.data.deletedAt).toBeInstanceOf(Date);
    expect(result.data.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.data.deletedAt.getTime()).toBeLessThanOrEqual(after);
  });
});
