import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  AnswerConfirmationInput,
  DueConfirmation,
  IsoDate,
  RecurrenceSchedule,
} from "@vireo/shared";
import { addDays, dueConfirmations, occurrencesInPeriod } from "@vireo/shared";

import { BudgetService, toSchedule } from "../budget/budget.service.js";
import { fromIsoDate } from "../common/dates.js";
import type { ConfirmationStatus } from "../generated/prisma/client.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

/** Co zapisać dla odpowiedzi — status, kwota i data wiersza. */
interface Answer {
  status: ConfirmationStatus;
  amount: number;
  date: IsoDate;
}

/**
 * Potwierdzanie wpływów i stałych płatności. Co czeka na odpowiedź,
 * liczy @vireo/shared (dueConfirmations) z tego samego snapshotu co
 * budżet. Tu tylko zapis odpowiedzi: jeden wiersz na termin (unikalny
 * indeks reguła/źródło + occurrenceDate), więc odpowiedź z powiadomienia
 * i z Dashboardu nie tworzy dwóch wydatków.
 */
@Injectable()
export class ConfirmationsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly budget: BudgetService,
  ) {}

  /** Terminy do potwierdzenia na dziś — bieżące i zaległe. */
  async due(userId: string): Promise<DueConfirmation[]> {
    return dueConfirmations(await this.budget.snapshot(userId));
  }

  /**
   * Zapisuje odpowiedź. 404 — cudza, nieistniejąca albo nieaktywna reguła
   * czy źródło; 422 — taki termin nie istnieje albo jest w przyszłości;
   * 409 — po zapłacie nie da się już odpowiedzieć „Jeszcze nie” ani
   * „Nie w tym okresie”. Ponowne potwierdzenie zapłaconego to no-op.
   */
  async answer(userId: string, input: AnswerConfirmationInput): Promise<void> {
    // Schemat już tego pilnuje; bez id `findFirst` dopasowałby dowolny wiersz.
    const id = input.kind === "EXPENSE" ? input.recurringRuleId : input.incomeSourceId;
    if (id === undefined) throw new BadRequestException();
    const { today } = await this.budget.snapshot(userId);
    if (input.kind === "EXPENSE") {
      await this.answerPayment(userId, id, input, today);
    } else {
      await this.answerIncome(userId, id, input, today);
    }
  }

  private async answerPayment(
    userId: string,
    ruleId: string,
    input: AnswerConfirmationInput,
    today: IsoDate,
  ): Promise<void> {
    const rule = await this.db.recurringRule.findFirst({
      where: { id: ruleId, userId, kind: "EXPENSE", isActive: true },
    });
    if (rule?.expectedAmount == null) throw new NotFoundException();
    assertOccurrence(toSchedule(rule), input.occurrenceDate, today);

    const key = { recurringRuleId: rule.id, occurrenceDate: fromIsoDate(input.occurrenceDate) };
    const existing = await this.db.transaction.findFirst({ where: key });
    const answer = toAnswer(input, rule.expectedAmount, today, existing?.status);
    if (!answer) return;

    const data = {
      status: answer.status,
      amount: answer.amount,
      date: fromIsoDate(answer.date),
      categoryId: rule.categoryId,
      note: rule.name,
      deletedAt: null,
    };
    // upsert trafia też w wiersz z kosza (soft-delete go nie filtruje) —
    // ponowne potwierdzenie usuniętej płatności przywraca ten sam wydatek.
    await this.db.transaction.upsert({
      where: { recurringRuleId_occurrenceDate: key },
      update: data,
      create: { ...data, ...key, userId },
    });
  }

  private async answerIncome(
    userId: string,
    sourceId: string,
    input: AnswerConfirmationInput,
    today: IsoDate,
  ): Promise<void> {
    const source = await this.db.incomeSource.findFirst({
      where: { id: sourceId, userId, kind: "REGULAR", isActive: true },
      include: { recurringRule: true },
    });
    if (!source?.recurringRule || source.expectedAmount === null) throw new NotFoundException();
    assertOccurrence(toSchedule(source.recurringRule), input.occurrenceDate, today);

    const key = { incomeSourceId: source.id, occurrenceDate: fromIsoDate(input.occurrenceDate) };
    const existing = await this.db.incomeEntry.findFirst({ where: key });
    const answer = toAnswer(input, source.expectedAmount, today, existing?.status);
    if (!answer) return;

    const data = {
      status: answer.status,
      amount: answer.amount,
      date: fromIsoDate(answer.date),
      deletedAt: null,
    };
    await this.db.incomeEntry.upsert({
      where: { incomeSourceId_occurrenceDate: key },
      update: data,
      create: { ...data, ...key, userId },
    });
  }
}

/** Termin musi być prawdziwym terminem reguły, nie późniejszym niż dziś. */
function assertOccurrence(schedule: RecurrenceSchedule, date: IsoDate, today: IsoDate): void {
  const upToToday = { start: schedule.startDate, end: today };
  if (schedule.startDate > today || !occurrencesInPeriod(schedule, upToToday).includes(date)) {
    throw new UnprocessableEntityException("Not an occurrence of this schedule up to today");
  }
}

/**
 * Wiersz dla odpowiedzi; `null` = nic do zapisania (zapłacone już
 * wcześniej). Przy „Jeszcze nie” data to jutro — od tego dnia appka
 * pyta znowu.
 */
function toAnswer(
  input: AnswerConfirmationInput,
  expectedAmount: number,
  today: IsoDate,
  existing: ConfirmationStatus | undefined,
): Answer | null {
  if (existing === "CONFIRMED") {
    if (input.answer === "CONFIRMED") return null;
    throw new ConflictException("Already confirmed");
  }
  switch (input.answer) {
    case "CONFIRMED":
      return { status: "CONFIRMED", amount: input.amount ?? expectedAmount, date: today };
    case "NOT_YET":
      return { status: "PENDING", amount: expectedAmount, date: addDays(today, 1) };
    case "SKIPPED":
      return { status: "DECLINED", amount: expectedAmount, date: today };
  }
}
