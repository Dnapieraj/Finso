import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateGoalDepositInput,
  CreateGoalInput,
  Goal,
  GoalDeposit,
  UpdateGoalInput,
} from "@vireo/shared";
import { todayInTimeZone } from "@vireo/shared";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { fromIsoDate, toIsoDate } from "../common/dates.js";
import type { GoalDeposit as GoalDepositRow, Goal as GoalRow } from "../generated/prisma/client.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

@Injectable()
export class GoalsService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Najbliższy termin pierwszy — to ten cel jest najbardziej "pilny". */
  async list(userId: string): Promise<Goal[]> {
    const rows = await this.db.goal.findMany({
      where: { userId },
      orderBy: [{ targetDate: "asc" }, { id: "asc" }],
    });
    const deposited = await this.depositedByGoal(userId);
    return rows.map((row) => toGoal(row, deposited.get(row.id) ?? 0));
  }

  async get(userId: string, id: string): Promise<Goal> {
    const row = await this.db.goal.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException();
    return toGoal(row, await this.depositedTo(this.db, userId, id));
  }

  /** `db` — transakcja, gdy zapis idzie razem z kluczem idempotencji. */
  async create(
    userId: string,
    input: CreateGoalInput,
    db: Db | DbTransaction = this.db,
  ): Promise<Goal> {
    const { currentAmount, ...fields } = input;
    const row = await db.goal.create({
      data: {
        ...fields,
        baseAmount: currentAmount,
        userId,
        targetDate: fromIsoDate(input.targetDate),
      },
    });
    return toGoal(row, 0);
  }

  /**
   * `currentAmount` to odłożone razem; wpłaty zostają, więc zmienia się
   * część wpisana ręcznie (korekta). Nie może zejść poniżej sumy wpłat —
   * wtedy trzeba usunąć wpłatę, a nie ukryć ją ujemną korektą.
   * `deletedAt: null` — jak przy transakcjach: nie edytujemy celów z kosza.
   */
  async update(userId: string, id: string, input: UpdateGoalInput): Promise<Goal> {
    const { currentAmount, ...fields } = input;
    return this.db.$transaction(async (tx) => {
      const deposited = await this.depositedTo(tx, userId, id);
      let baseAmount: number | undefined;
      if (currentAmount !== undefined) {
        baseAmount = currentAmount - deposited;
        if (baseAmount < 0) throw belowDeposits();
      }
      const row = await tx.goal.update({
        where: { id, userId, deletedAt: null },
        data: {
          ...fields,
          baseAmount,
          targetDate: fields.targetDate && fromIsoDate(fields.targetDate),
        },
      });
      return toGoal(row, deposited);
    });
  }

  /** Miękkie usunięcie — postęp celu da się odzyskać przez restore. */
  async remove(userId: string, id: string): Promise<void> {
    await this.db.goal.delete({ where: { id, userId, deletedAt: null } });
  }

  async restore(userId: string, id: string): Promise<Goal> {
    const row = await this.db.goal.update({
      where: { id, userId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return toGoal(row, await this.depositedTo(this.db, userId, id));
  }

  /** Najnowsza pierwsza. Cel w koszu albo cudzy → 404. */
  async listDeposits(userId: string, goalId: string): Promise<GoalDeposit[]> {
    await this.assertGoal(this.db, userId, goalId);
    const rows = await this.db.goalDeposit.findMany({
      where: { userId, goalId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
    });
    return rows.map(toDeposit);
  }

  /** Bez daty — dziś w strefie użytkownika; z przyszłości — 400. */
  async createDeposit(
    userId: string,
    goalId: string,
    input: CreateGoalDepositInput,
    db: Db | DbTransaction = this.db,
  ): Promise<GoalDeposit> {
    await this.assertGoal(db, userId, goalId);
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const today = todayInTimeZone(this.clock.now(), user.timezone);
    const date = input.date ?? today;
    if (date > today) throw futureDeposit();
    const row = await db.goalDeposit.create({
      data: { userId, goalId, amount: input.amount, date: fromIsoDate(date) },
    });
    return toDeposit(row);
  }

  /** Miękkie usunięcie — „Cofnij” przywraca wpłatę. */
  async removeDeposit(userId: string, goalId: string, id: string): Promise<void> {
    await this.db.goalDeposit.delete({ where: { id, userId, goalId, deletedAt: null } });
  }

  async restoreDeposit(userId: string, goalId: string, id: string): Promise<GoalDeposit> {
    const row = await this.db.goalDeposit.update({
      where: { id, userId, goalId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return toDeposit(row);
  }

  /** Suma nieusuniętych wpłat każdego celu użytkownika. */
  private async depositedByGoal(userId: string): Promise<Map<string, number>> {
    const sums = await this.db.goalDeposit.groupBy({
      by: ["goalId"],
      where: { userId },
      _sum: { amount: true },
    });
    return new Map(sums.map((row) => [row.goalId, row._sum.amount ?? 0]));
  }

  private async depositedTo(db: Db | DbTransaction, userId: string, goalId: string) {
    const sum = await db.goalDeposit.aggregate({
      where: { userId, goalId },
      _sum: { amount: true },
    });
    return sum._sum.amount ?? 0;
  }

  private async assertGoal(db: Db | DbTransaction, userId: string, goalId: string) {
    const found = await db.goal.count({ where: { id: goalId, userId } });
    if (found === 0) throw new NotFoundException();
  }
}

/** Ten sam kształt co błędy walidacji nestjs-zod — klient obsługuje oba jednym kodem. */
function validationError(path: string, code: string): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    message: "Validation failed",
    errors: [{ code, path: [path], message: code }],
  });
}

const belowDeposits = () => validationError("currentAmount", "below_deposits");
const futureDeposit = () => validationError("date", "in_future");

function toGoal(row: GoalRow, deposited: number): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.targetAmount,
    currentAmount: row.baseAmount + deposited,
    targetDate: toIsoDate(row.targetDate),
  };
}

function toDeposit(row: GoalDepositRow): GoalDeposit {
  return {
    id: row.id,
    goalId: row.goalId,
    amount: row.amount,
    date: toIsoDate(row.date),
  };
}
