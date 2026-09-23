import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { PublicUser, UpdateMeInput } from '@vireo/shared';

import { PasswordService } from '../auth/password.service.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';
import { publicUserSelect, toPublicUser } from './public-user.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
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

  /** Ustawienia wpływające na budżet: strefa czasowa i dzień startu okresu. */
  async updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
    const user = await this.db.user.update({
      where: { id: userId },
      data: input,
      select: publicUserSelect,
    });
    return toPublicUser(user);
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
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid password');
    }
    await this.db.user.delete({ where: { id: userId } });
  }
}
