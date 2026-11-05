import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import type { Env } from "../config/env.js";
import type { EmailCodePurpose } from "../generated/prisma/client.js";
import type { Mailer } from "../mail/mailer.js";
import { MAILER } from "../mail/mailer.js";
import { emailChangeMail, emailVerificationMail, passwordResetMail } from "../mail/messages.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

const MINUTE_MS = 60 * 1000;

/** Jak długo kod działa. Reset krótko — to klucz do konta; adres spokojnie. */
const TTL_MS: Record<EmailCodePurpose, number> = {
  PASSWORD_RESET: 15 * MINUTE_MS,
  EMAIL_VERIFICATION: 24 * 60 * MINUTE_MS,
  EMAIL_CHANGE: 30 * MINUTE_MS,
};

/** Nowy kod najwyżej raz na minutę — przycisk „Wyślij ponownie” nie zasypie skrzynki. */
const RESEND_AFTER_MS = MINUTE_MS;

/** Po tylu złych próbach kod przestaje działać: 5 strzałów na milion kombinacji. */
const MAX_ATTEMPTS = 5;

/**
 * Jednorazowe 6-cyfrowe kody wysyłane e-mailem. W bazie HMAC kodu z sekretem
 * serwera (EMAIL_CODE_SECRET), związany z użytkownikiem i celem — kod resetu
 * nie potwierdzi adresu ani nie zadziała dla innego konta, a wyciek samej
 * bazy nie pozwala odgadnąć kodów offline.
 */
@Injectable()
export class EmailCodeService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  /**
   * Wysyła kod (nowy albo — w ciągu minuty od poprzedniego — żaden, bo
   * poprzedni nadal działa). Rzuca, gdy e-mail nie wyszedł.
   */
  async send(
    user: { id: string; email: string },
    purpose: Exclude<EmailCodePurpose, "EMAIL_CHANGE">,
  ): Promise<void> {
    const code = await this.issue(user.id, purpose);
    if (code === null) return;
    const mail =
      purpose === "PASSWORD_RESET"
        ? passwordResetMail(user.email, code)
        : emailVerificationMail(user.email, code);
    await this.mailer.send(mail);
  }

  /** Kod zmiany adresu na NOWY adres; jak `send` — rzuca, gdy e-mail nie wyszedł. */
  async sendEmailChange(userId: string, newEmail: string): Promise<void> {
    const code = await this.issue(userId, "EMAIL_CHANGE", newEmail);
    if (code === null) return;
    await this.mailer.send(emailChangeMail(newEmail, code));
  }

  /**
   * Nowy kod; poprzednie tego samego celu przestają działać. `null`, gdy
   * kod (na ten sam adres) wysłano mniej niż minutę temu — poprzedni nadal działa.
   */
  async issue(
    userId: string,
    purpose: EmailCodePurpose,
    newEmail: string | null = null,
  ): Promise<string | null> {
    const now = this.clock.now();
    const recent = await this.db.emailCode.findFirst({
      where: {
        userId,
        purpose,
        newEmail,
        usedAt: null,
        createdAt: { gt: new Date(now.getTime() - RESEND_AFTER_MS) },
      },
    });
    if (recent) return null;

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.db.$transaction([
      this.db.emailCode.updateMany({
        where: { userId, purpose, usedAt: null },
        data: { usedAt: now },
      }),
      this.db.emailCode.create({
        data: {
          userId,
          purpose,
          newEmail,
          codeHash: this.hash(userId, purpose, code, newEmail),
          expiresAt: new Date(now.getTime() + TTL_MS[purpose]),
          createdAt: now,
        },
      }),
    ]);
    return code;
  }

  /**
   * Zużywa kod, jeśli pasuje. Zły kod zwiększa licznik prób; wygasły,
   * zużyty albo po 5 złych próbach — zawsze `false`.
   */
  async consume(
    userId: string,
    purpose: Exclude<EmailCodePurpose, "EMAIL_CHANGE">,
    code: string,
  ): Promise<boolean> {
    return (await this.claim(userId, purpose, code)) !== null;
  }

  /** Zużywa kod zmiany adresu; zwraca adres, który kod ustawia, albo `null`. */
  async consumeEmailChange(userId: string, code: string): Promise<string | null> {
    return (await this.claim(userId, "EMAIL_CHANGE", code))?.newEmail ?? null;
  }

  private async claim(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<{ newEmail: string | null } | null> {
    const now = this.clock.now();
    const active = await this.db.emailCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (!active || active.attempts >= MAX_ATTEMPTS) return null;

    const expected = Buffer.from(active.codeHash, "hex");
    const given = Buffer.from(this.hash(userId, purpose, code, active.newEmail), "hex");
    if (!timingSafeEqual(expected, given)) {
      await this.db.emailCode.update({
        where: { id: active.id },
        data: { attempts: { increment: 1 } },
      });
      return null;
    }
    // Warunek `usedAt: null` w samym UPDATE: dwa równoległe żądania z tym
    // samym kodem — tylko jedno go zużyje.
    const claimed = await this.db.emailCode.updateMany({
      where: { id: active.id, usedAt: null },
      data: { usedAt: now },
    });
    return claimed.count === 1 ? { newEmail: active.newEmail } : null;
  }

  /** Adres w HMAC: kod zmiany zadziała tylko dla adresu, na który go wysłano. */
  private hash(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
    newEmail: string | null = null,
  ): string {
    const subject =
      newEmail === null
        ? `${purpose}:${userId}:${code}`
        : `${purpose}:${userId}:${code}:${newEmail}`;
    return createHmac("sha256", this.config.get("EMAIL_CODE_SECRET", { infer: true }))
      .update(subject)
      .digest("hex");
  }
}
