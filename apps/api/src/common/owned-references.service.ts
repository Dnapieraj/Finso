import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import type { RecurringRuleKind } from '../generated/prisma/client.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

/**
 * Sprawdza identyfikatory przysłane w BODY (categoryId, incomeSourceId...).
 *
 * Filtr `userId` na zapisywanym wierszu nie wystarcza: transakcja
 * użytkownika A z `categoryId` kategorii użytkownika B przeszłaby przez
 * klucz obcy bez błędu — i odsłoniłaby A nazwę cudzej kategorii.
 *
 * Nieistniejący i cudzy identyfikator dają tę samą odpowiedź, żeby nie
 * dało się sondować, które id należą do innych.
 * `null`/`undefined` = "bez powiązania" (albo "bez zmiany" w PATCH) — OK.
 */
@Injectable()
export class OwnedReferencesService {
  constructor(@Inject(PRISMA) private readonly db: Db) {}

  /** Kategoria systemowa (userId = null) albo własna. */
  async assertCategory(userId: string, categoryId: string | null | undefined): Promise<void> {
    if (!categoryId) return;
    const found = await this.db.category.count({
      where: { id: categoryId, OR: [{ userId }, { userId: null }] },
    });
    if (found === 0) throw unknownReference('categoryId');
  }

  /** Własna reguła określonego rodzaju — wydatek nie podepnie się pod regułę dochodu. */
  async assertRecurringRule(
    userId: string,
    ruleId: string | null | undefined,
    kind: RecurringRuleKind,
  ): Promise<void> {
    if (!ruleId) return;
    const found = await this.db.recurringRule.count({ where: { id: ruleId, userId, kind } });
    if (found === 0) throw unknownReference('recurringRuleId');
  }

  /** Własne źródło dochodu. */
  async assertIncomeSource(userId: string, sourceId: string): Promise<void> {
    const found = await this.db.incomeSource.count({ where: { id: sourceId, userId } });
    if (found === 0) throw unknownReference('incomeSourceId');
  }
}

function unknownReference(field: string): BadRequestException {
  // Ten sam kształt co błędy walidacji nestjs-zod — klient obsługuje
  // oba jednym kodem.
  return new BadRequestException({
    statusCode: 400,
    message: 'Validation failed',
    errors: [{ code: 'unknown_reference', path: [field], message: 'unknown_reference' }],
  });
}
