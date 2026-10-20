import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Clock } from "../common/clock.js";
import { CLOCK } from "../common/clock.js";
import type { Env } from "../config/env.js";
import type { EmailCodePurpose } from "../generated/prisma/client.js";
import type { Mailer } from "../mail/mailer.js";
import { MAILER } from "../mail/mailer.js";
import { emailVerificationMail, passwordResetMail } from "../mail/messages.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";

const MINUTE_MS = 60 * 1000;

/** Jak długo kod działa. Reset krótko — to klucz do konta; adres spokojnie. */
const TTL_MS: Record<EmailCodePurpose, number> = {
  PASSWORD_RESET: 15 * MINUTE_MS,
  EMAIL_VERIFICATION: 24 * 60 * MINUTE_MS,
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
  async send(user: { id: string; email: string }, purpose: EmailCodePurpose): Promise<void> {
    const code = await this.issue(user.id, purpose);
    if (code === null) return;
    const mail =
      purpose === "PASSWORD_RESET"
        ? passwordResetMail(user.email, code)
        : emailVerificationMail(user.email, code);
    await this.mailer.send(mail);
  }

  /**
   * Nowy kod; poprzednie tego samego celu przestają działać. `null`, gdy
   * kod wysłano mniej niż minutę temu — poprzedni nadal działa.
   */
  async issue(userId: string, purpose: EmailCodePurpose): Promise<string | null> {
    const now = this.clock.now();
    const recent = await this.db.emailCode.findFirst({
      where: {
        userId,
        purpose,
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
          codeHash: this.hash(userId, purpose, code),
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
  async consume(userId: string, purpose: EmailCodePurpose, code: string): Promise<boolean> {
    const now = this.clock.now();
    const active = await this.db.emailCode.findFirst({
      where: { userId, purpose, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (!active || active.attempts >= MAX_ATTEMPTS) return false;

    const expected = Buffer.from(active.codeHash, "hex");
    const given = Buffer.from(this.hash(userId, purpose, code), "hex");
    if (!timingSafeEqual(expected, given)) {
      await this.db.emailCode.update({
        where: { id: active.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }
    // Warunek `usedAt: null` w samym UPDATE: dwa równoległe żądania z tym
    // samym kodem — tylko jedno go zużyje.
    const claimed = await this.db.emailCode.updateMany({
      where: { id: active.id, usedAt: null },
      data: { usedAt: now },
    });
    return claimed.count === 1;
  }

  private hash(userId: string, purpose: EmailCodePurpose, code: string): string {
    return createHmac("sha256", this.config.get("EMAIL_CODE_SECRET", { infer: true }))
      .update(`${purpose}:${userId}:${code}`)
      .digest("hex");
  }
}
