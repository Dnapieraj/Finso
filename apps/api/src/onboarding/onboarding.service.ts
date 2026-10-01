import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { CompleteOnboardingInput, OnboardingIncome, PublicUser } from "@vireo/shared";
import { currentBudgetPeriod, todayInTimeZone } from "@vireo/shared";

import { OTHER_CATEGORY_ID } from "../categories/system-category-ids.js";
import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { fromIsoDate } from "../common/dates.js";
import { OwnedReferencesService } from "../common/owned-references.service.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";
import { publicUserSelect, toPublicUser } from "../users/public-user.js";

/** Notatka wydatku z kroku „Ile już wydano od ostatniej wypłaty?”. */
export const PRE_FINSO_EXPENSE_NOTE = "Wydatki przed Finso";

@Injectable()
export class OnboardingService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly refs: OwnedReferencesService,
  ) {}

  /**
   * Zapisuje odpowiedzi z onboardingu w jednej transakcji bazy: ustawienia
   * okresu, źródło dochodu, stałe zobowiązania, wydatki sprzed appki i
   * znacznik ukończenia. Przerwany albo odrzucony onboarding nie zostawia
   * połowy danych, a drugi (także równoległy) dostaje 409 zamiast duplikatów.
   *
   * Reguły startują od początku BIEŻĄCEGO okresu, liczonego w strefie
   * z onboardingu: wypłata i zobowiązania z tego okresu, także te sprzed
   * dziś, od razu wchodzą do budżetu.
   *
   * @throws {ConflictException} gdy onboarding był już ukończony.
   */
  async complete(userId: string, input: CompleteOnboardingInput): Promise<PublicUser> {
    // Odczyty poza transakcją — niczego nie zapisują, a nieznana kategoria
    // kończy się 400, zanim cokolwiek powstanie.
    for (const categoryId of new Set(input.commitments.map((c) => c.categoryId))) {
      await this.refs.assertCategory(userId, categoryId);
    }
    const now = this.clock.now();
    const today = todayInTimeZone(now, input.timezone);
    const startDate = fromIsoDate(currentBudgetPeriod(today, input.periodStartDay).start);
    const spentCategoryId = input.spentThisPeriod === null ? null : await this.otherCategoryId();

    return this.db.$transaction(async (tx) => {
      // Warunek `onboardingCompletedAt: null` w samym UPDATE: z dwóch
      // równoległych żądań drugie czeka na blokadę wiersza, a po commicie
      // pierwszego nie spełnia już warunku (count = 0).
      const { count } = await tx.user.updateMany({
        where: { id: userId, onboardingCompletedAt: null },
        data: {
          periodStartDay: input.periodStartDay,
          timezone: input.timezone,
          onboardingCompletedAt: now,
        },
      });
      if (count === 0) {
        const exists = await tx.user.count({ where: { id: userId } });
        // Konto usunięte przy ważnym tokenie: 401, jak w UsersService.getMe.
        if (exists === 0) throw new UnauthorizedException();
        throw new ConflictException("Onboarding already completed");
      }

      await createIncome(tx, userId, input.income, startDate, fromIsoDate(today));

      for (const commitment of input.commitments) {
        await tx.recurringRule.create({
          data: {
            userId,
            kind: "EXPENSE",
            name: commitment.name,
            frequency: "MONTHLY",
            startDate,
            dayOfMonth: commitment.dayOfMonth,
            expectedAmount: commitment.amount,
            categoryId: commitment.categoryId,
          },
        });
      }

      if (input.spentThisPeriod !== null) {
        await tx.transaction.create({
          data: {
            userId,
            amount: input.spentThisPeriod,
            date: fromIsoDate(today),
            categoryId: spentCategoryId,
            note: PRE_FINSO_EXPENSE_NOTE,
            status: "CONFIRMED",
          },
        });
      }

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: publicUserSelect,
      });
      return toPublicUser(user);
    });
  }

  /**
   * „Inne” z seeda. Baza bez seeda (np. świeża instancja) nie może
   * wywrócić onboardingu na kluczu obcym — wtedy wydatek bez kategorii.
   */
  private async otherCategoryId(): Promise<string | null> {
    const found = await this.db.category.count({ where: { id: OTHER_CATEGORY_ID, userId: null } });
    return found === 0 ? null : OTHER_CATEGORY_ID;
  }
}

/**
 * Regularny: źródło z kwotą podpięte pod miesięczną regułę INCOME (kwota
 * żyje w źródle, reguła to tylko harmonogram). Nieregularny: samo źródło —
 * silnik liczy go z potwierdzonych wpływów, więc to, co już wpłynęło,
 * staje się wpływem z dzisiejszą datą.
 */
async function createIncome(
  tx: DbTransaction,
  userId: string,
  income: OnboardingIncome,
  startDate: Date,
  today: Date,
): Promise<void> {
  if (income.kind === "REGULAR") {
    const rule = await tx.recurringRule.create({
      data: {
        userId,
        kind: "INCOME",
        frequency: "MONTHLY",
        startDate,
        dayOfMonth: income.dayOfMonth,
      },
    });
    await tx.incomeSource.create({
      data: {
        userId,
        name: income.name,
        kind: "REGULAR",
        expectedAmount: income.amount,
        recurringRuleId: rule.id,
      },
    });
    return;
  }

  const source = await tx.incomeSource.create({
    data: { userId, name: income.name, kind: "IRREGULAR" },
  });
  if (income.receivedThisPeriod !== null) {
    await tx.incomeEntry.create({
      data: {
        userId,
        incomeSourceId: source.id,
        amount: income.receivedThisPeriod,
        date: today,
        status: "CONFIRMED",
      },
    });
  }
}
