import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateIncomeSourceInput,
  IncomeSource,
  Schedule,
  UpdateIncomeSourceInput,
} from "@vireo/shared";
import { incomeSourceShapeSchema } from "@vireo/shared";
import { ZodValidationException } from "nestjs-zod";

import { fromIsoDate, toIsoDate } from "../common/dates.js";
import { OwnedReferencesService } from "../common/owned-references.service.js";
import type {
  IncomeSource as IncomeSourceRow,
  RecurringRule as RecurringRuleRow,
} from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { Db, DbTransaction } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

const UNIQUE_VIOLATION = "P2002";
const FOREIGN_KEY_VIOLATION = "P2003";

/** Źródło z podpiętą regułą — z niej bierze się `schedule` w odpowiedzi. */
type SourceWithRule = IncomeSourceRow & { recurringRule: RecurringRuleRow | null };

const withRule = { recurringRule: true } as const;

@Injectable()
export class IncomeSourcesService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly refs: OwnedReferencesService,
  ) {}

  async list(userId: string): Promise<IncomeSource[]> {
    const rows = await this.db.incomeSource.findMany({
      where: { userId },
      include: withRule,
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toIncomeSource);
  }

  async get(userId: string, id: string): Promise<IncomeSource> {
    const row = await this.db.incomeSource.findFirst({ where: { id, userId }, include: withRule });
    if (!row) throw new NotFoundException();
    return toIncomeSource(row);
  }

  /**
   * Z `schedule` — źródło i reguła INCOME w jednej transakcji: zerwane
   * połączenie nie zostawi samotnej reguły, której budżet i tak nie liczy.
   */
  async create(
    userId: string,
    input: CreateIncomeSourceInput,
    /** Transakcja klucza idempotencji; bez niej — własna. */
    tx?: DbTransaction,
  ): Promise<IncomeSource> {
    const { schedule, ...fields } = input;
    await this.refs.assertRecurringRule(userId, fields.recurringRuleId, "INCOME");
    const write = async (db: DbTransaction) => {
      const recurringRuleId = schedule
        ? (await createIncomeRule(db, userId, schedule)).id
        : fields.recurringRuleId;
      const row = await db.incomeSource.create({
        data: { ...fields, recurringRuleId, userId },
        include: withRule,
      });
      return toIncomeSource(row);
    };
    return withRuleConflict(() => (tx ? write(tx) : this.db.$transaction(write)));
  }

  /**
   * Spójność REGULAR/IRREGULAR sprawdzana po scaleniu ze stanem z bazy, jak
   * przy regułach. `schedule` zmienia podpiętą regułę (id zostaje), tworzy
   * ją, gdy jej nie było, a `null` odpina i usuwa — reguła INCOME to tylko
   * harmonogram tego źródła.
   */
  async update(userId: string, id: string, input: UpdateIncomeSourceInput): Promise<IncomeSource> {
    const existing = await this.db.incomeSource.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException();
    const { schedule, ...fields } = input;

    const keepsRule =
      fields.recurringRuleId !== undefined
        ? fields.recurringRuleId !== null
        : existing.recurringRuleId !== null;
    const shape = incomeSourceShapeSchema.safeParse({
      kind: fields.kind ?? existing.kind,
      expectedAmount:
        fields.expectedAmount !== undefined ? fields.expectedAmount : existing.expectedAmount,
      hasSchedule: schedule !== undefined ? schedule !== null : keepsRule,
    });
    if (!shape.success) throw new ZodValidationException(shape.error);
    await this.refs.assertRecurringRule(userId, fields.recurringRuleId, "INCOME");

    return withRuleConflict(() =>
      this.db.$transaction(async (tx) => {
        // undefined = bez zmiany powiązania.
        let recurringRuleId = schedule === null ? null : fields.recurringRuleId;
        if (schedule && existing.recurringRuleId) {
          await tx.recurringRule.update({
            where: { id: existing.recurringRuleId, userId },
            data: scheduleData(schedule),
          });
        } else if (schedule) {
          recurringRuleId = (await createIncomeRule(tx, userId, schedule)).id;
        }

        const row = await tx.incomeSource.update({
          where: { id, userId },
          data: { ...fields, recurringRuleId },
          include: withRule,
        });
        // Odpięta reguła była tylko harmonogramem tego źródła — nie zostawiamy jej.
        if (schedule === null && existing.recurringRuleId) {
          await tx.recurringRule.delete({ where: { id: existing.recurringRuleId, userId } });
        }
        return toIncomeSource(row);
      }),
    );
  }

  /**
   * Twarde usunięcie — tylko źródła bez wpływów (np. dodanego przez
   * pomyłkę). Źródło z historią się archiwizuje (`isActive: false`).
   * Pilnuje tego baza (FK z onDelete: NoAction), nie ten kod: widzi też
   * wpływy w koszu, których soft-delete extension nam nie pokaże.
   */
  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.db.incomeSource.delete({ where: { id, userId } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === FOREIGN_KEY_VIOLATION
      ) {
        throw new ConflictException(
          "Income source has income entries (possibly deleted) — archive it with isActive: false",
        );
      }
      throw error;
    }
  }
}

function scheduleData(schedule: Schedule) {
  return { ...schedule, startDate: fromIsoDate(schedule.startDate) };
}

function createIncomeRule(tx: DbTransaction, userId: string, schedule: Schedule) {
  return tx.recurringRule.create({ data: { ...scheduleData(schedule), userId, kind: "INCOME" } });
}

/** Reguła może opisywać tylko jedno źródło (unikalny recurringRuleId). */
async function withRuleConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
      throw new ConflictException("Recurring rule already linked to another income source");
    }
    throw error;
  }
}

function toIncomeSource(row: SourceWithRule): IncomeSource {
  const rule = row.recurringRule;
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    expectedAmount: row.expectedAmount,
    recurringRuleId: row.recurringRuleId,
    isActive: row.isActive,
    schedule: rule && {
      frequency: rule.frequency,
      interval: rule.interval,
      startDate: toIsoDate(rule.startDate),
      dayOfMonth: rule.dayOfMonth,
      dayOfWeek: rule.dayOfWeek,
    },
  };
}
