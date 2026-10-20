import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type {
  ConfirmSubscriptionInput,
  RecurringRule,
  SubscriptionPayment,
  SubscriptionsOverview,
} from "@vireo/shared";
import { addDays, grosze, subscriptionsOverview, todayInTimeZone } from "@vireo/shared";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { fromIsoDate, toIsoDate } from "../common/dates.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";
import { RecurringRulesService } from "../recurring-rules/recurring-rules.service.js";

/**
 * Ile dni historii czyta detektor. Opłata roczna potrzebuje dwóch płatności
 * (odstęp do 380 dni), a ostatnia może być sprzed 400 dni — razem 780.
 */
const HISTORY_DAYS = 790;

/**
 * Warstwa między bazą a detektorem z @vireo/shared: ładuje wydatki
 * i stałe płatności użytkownika, woła czystą funkcję. Wykrytych pozycji
 * nie zapisujemy — tylko odrzucenia („To nie subskrypcja”).
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly rules: RecurringRulesService,
  ) {}

  async overview(userId: string): Promise<SubscriptionsOverview> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (!user) throw new UnauthorizedException();
    const asOf = todayInTimeZone(this.clock.now(), user.timezone);

    // Soft-delete extension pomija wydatki w koszu (działa tylko na zapytaniach
    // głównych, dlatego płatności reguł bierzemy z tej samej listy, nie z include).
    const [transactions, rules, dismissals] = await Promise.all([
      this.db.transaction.findMany({
        where: { userId, date: { gte: fromIsoDate(addDays(asOf, -HISTORY_DAYS)) } },
        select: {
          date: true,
          amount: true,
          note: true,
          categoryId: true,
          status: true,
          recurringRuleId: true,
          beforeFinso: true,
        },
      }),
      this.db.recurringRule.findMany({ where: { userId, kind: "EXPENSE", isActive: true } }),
      this.db.subscriptionDismissal.findMany({ where: { userId }, select: { key: true } }),
    ]);

    const expenses = transactions.map((tx) => ({
      ...tx,
      date: toIsoDate(tx.date),
      amount: grosze(tx.amount),
    }));
    const paymentsByRule = new Map<string, SubscriptionPayment[]>();
    for (const expense of expenses) {
      if (expense.recurringRuleId === null || expense.status !== "CONFIRMED") continue;
      const payments = paymentsByRule.get(expense.recurringRuleId) ?? [];
      payments.push({ date: expense.date, amount: expense.amount });
      paymentsByRule.set(expense.recurringRuleId, payments);
    }

    return subscriptionsOverview({
      asOf,
      expenses,
      // Reguła EXPENSE bez kwoty nie przejdzie walidacji API — gdyby jakaś
      // była w bazie, nie ma z czym porównać, więc ją pomijamy.
      rules: rules.flatMap((rule) =>
        rule.expectedAmount === null
          ? []
          : [
              {
                id: rule.id,
                name: rule.name ?? "",
                frequency: rule.frequency,
                interval: rule.interval,
                expectedAmount: grosze(rule.expectedAmount),
                categoryId: rule.categoryId,
                isSubscription: rule.isSubscription,
                payments: paymentsByRule.get(rule.id) ?? [],
              },
            ],
      ),
      dismissedKeys: dismissals.map((dismissal) => dismissal.key),
    });
  }

  /**
   * „To subskrypcja”: stała płatność od następnego terminu, z kwotą ostatniej
   * płatności. Pozycję liczymy od nowa po kluczu — klient nie przysyła kwot.
   */
  async confirm(
    userId: string,
    input: ConfirmSubscriptionInput,
    db?: DbTransaction,
  ): Promise<RecurringRule> {
    const { detected } = await this.overview(userId);
    const item = detected.find((candidate) => candidate.key === input.key);
    if (!item) throw new NotFoundException();
    return this.rules.create(
      userId,
      {
        kind: "EXPENSE",
        name: input.name,
        ...item.schedule,
        expectedAmount: item.amount,
        categoryId: item.categoryId,
        isSubscription: true,
      },
      db,
    );
  }

  /** „To nie subskrypcja” — ponowne odrzucenie tego samego klucza nic nie zmienia. */
  async dismiss(userId: string, key: string): Promise<void> {
    await this.db.subscriptionDismissal.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key },
      update: {},
    });
  }

  /** „Cofnij” po odrzuceniu. */
  async undismiss(userId: string, key: string): Promise<void> {
    await this.db.subscriptionDismissal.deleteMany({ where: { userId, key } });
  }
}
