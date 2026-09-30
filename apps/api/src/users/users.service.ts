import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PublicUser, UpdateMeInput } from "@vireo/shared";
import { rebaseRuleStarts, todayInTimeZone } from "@vireo/shared";

import { PasswordService } from "../auth/password.service.js";
import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import { fromIsoDate, toIsoDate } from "../common/dates.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";
import { publicUserSelect, toPublicUser } from "./public-user.js";

@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * Profil zalogowanego użytkownika. Brak rekordu przy ważnym tokenie
   * oznacza konto usunięte w trakcie życia access tokena — 401, żeby
   * klient wyczyścił sesję, a nie 404 sugerujące błąd po stronie API.
   */
  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) {
      throw new UnauthorizedException();
    }
    return toPublicUser(user);
  }

  /**
   * Ustawienia wpływające na budżet: strefa czasowa i dzień startu okresu.
   *
   * Nowy dzień wypłaty przesuwa też start reguł, które obejmowały cały
   * stary okres (rebaseRuleStarts) — inaczej płatność między nowym
   * a starym początkiem okresu by zginęła. Wszystko w jednej transakcji,
   * z blokadą wiersza użytkownika: dwa równoległe PATCH-e liczyłyby
   * przesunięcie od tego samego „starego” dnia.
   */
  async updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
    return this.db.$transaction(async (tx) => {
      const [before] = await tx.$queryRaw<
        { periodStartDay: number; timezone: string; onboardingCompletedAt: Date | null }[]
      >`SELECT "periodStartDay", "timezone", "onboardingCompletedAt" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      // Konto usunięte przy ważnym tokenie: 401, jak w getMe.
      if (!before) throw new UnauthorizedException();

      if (input.periodStartDay !== undefined && input.periodStartDay !== before.periodStartDay) {
        const timezone = input.timezone ?? before.timezone;
        const rules = await tx.recurringRule.findMany({
          where: { userId },
          select: { id: true, kind: true, frequency: true, interval: true, startDate: true },
        });
        const changes = rebaseRuleStarts(
          rules.map((rule) => ({ ...rule, startDate: toIsoDate(rule.startDate) })),
          {
            today: todayInTimeZone(this.clock.now(), timezone),
            fromPeriodStartDay: before.periodStartDay,
            toPeriodStartDay: input.periodStartDay,
            onboardedOn:
              before.onboardingCompletedAt &&
              todayInTimeZone(before.onboardingCompletedAt, timezone),
          },
        );
        for (const change of changes) {
          await tx.recurringRule.update({
            where: { id: change.id, userId },
            data: { startDate: fromIsoDate(change.startDate) },
          });
        }
      }

      const user = await tx.user.update({
        where: { id: userId },
        data: input,
        select: publicUserSelect,
      });
      return toPublicUser(user);
    });
  }

  /**
   * Trwale usuwa konto i WSZYSTKIE dane użytkownika (RODO art. 17,
   * wymóg App Store 5.1.1(v)).
   *
   * Jeden DELETE na tabeli User — resztę robi baza: każda relacja do User
   * ma `onDelete: Cascade`, więc transakcje, cele, dochody, reguły,
   * kategorie własne i refresh tokeny znikają atomowo w tej samej
   * operacji. Soft-delete extension nie dotyczy modelu User i nie
   * przechwytuje kaskady (ta dzieje się w Postgresie, nie w Prismie), więc
   * miękko usunięte transakcje też są kasowane na twardo.
   */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    const valid = await this.passwords.verify(user?.passwordHash ?? null, password);
    // Konto usunięte przy ważnym tokenie: 401, jak w getMe — klient kończy sesję.
    if (!user) {
      throw new UnauthorizedException();
    }
    // Złe hasło to odmowa, nie nieważny token: 401 kazałby klientowi odświeżyć
    // sesję i ponowić żądanie z tym samym hasłem.
    if (!valid) {
      throw new ForbiddenException("Invalid password");
    }
    await this.db.user.delete({ where: { id: userId } });
  }
}
