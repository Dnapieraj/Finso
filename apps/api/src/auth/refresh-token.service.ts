import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.js';
import type { Db } from '../prisma/prisma.module.js';
import { PRISMA } from '../prisma/prisma.module.js';

/** Klient Prismy wewnątrz `$transaction` — ten sam kształt co Db, bez metod transakcji. */
type DbTx = Parameters<Parameters<Db['$transaction']>[0]>[0];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refresh tokeny: losowe, nieprzezroczyste ciągi (NIE JWT), przechowywane
 * w bazie jako hash SHA-256, rotowane przy każdym użyciu.
 *
 * Dlaczego nie JWT: refresh token i tak musi być sprawdzany w bazie
 * (unieważnienie, rotacja), więc samowystarczalność JWT nic tu nie daje,
 * a nieprzezroczysty token nie da się pomylić z access tokenem.
 *
 * Dlaczego SHA-256, a nie argon2 jak hasła: token ma 256 bitów losowości,
 * więc zgadywanie jest niewykonalne niezależnie od szybkości hasha. Wolny
 * hash chroni hasła, bo ludzie wybierają przewidywalne hasła. Szybki,
 * deterministyczny hash pozwala też szukać tokena po unikalnym indeksie.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Wydaje pierwszy token nowej rodziny (logowanie, rejestracja). */
  issueForNewSession(userId: string): Promise<string> {
    return this.createToken(this.db, userId, randomUUID());
  }

  /**
   * Wymienia refresh token na nowy. Stary jest unieważniany, nowy trafia
   * do tej samej rodziny. Użycie tokena już unieważnionego = sygnał
   * kradzieży: unieważniamy całą rodzinę i odmawiamy.
   */
  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    const existing = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    if (existing.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const refreshToken = await this.db.$transaction(async (tx) => {
      // Warunek `revokedAt: null` w samym UPDATE, a nie tylko w odczycie
      // wyżej: dwa równoległe żądania z tym samym tokenem przeszłyby oba
      // przez sprawdzenie w JS. Baza gwarantuje, że tylko jedno z nich
      // faktycznie "przejmie" token (count === 1).
      const claimed = await tx.refreshToken.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count === 0) {
        return null;
      }
      return this.createToken(tx, existing.userId, existing.familyId);
    });

    if (refreshToken === null) {
      // Przegrany wyścig to też ponowne użycie tego samego tokena.
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    return { userId: existing.userId, refreshToken };
  }

  /**
   * Wylogowanie: unieważnia całą rodzinę tokena (tę jedną sesję).
   * Idempotentne — nieznany lub już unieważniony token nie jest błędem,
   * bo klient po wylogowaniu i tak wyrzuca tokeny.
   */
  async revoke(rawToken: string): Promise<void> {
    const existing = await this.db.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { familyId: true },
    });
    if (existing) {
      await this.revokeFamily(existing.familyId);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async createToken(db: Db | DbTx, userId: string, familyId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
      },
    });
    return rawToken;
  }
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
