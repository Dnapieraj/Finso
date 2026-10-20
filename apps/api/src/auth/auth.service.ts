import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type {
  AuthSession,
  AuthTokens,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "@vireo/shared";

import type { Env } from "../config/env.js";
import type { User } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../prisma/prisma.module.js";
import { PRISMA } from "../prisma/prisma.module.js";
import { toPublicUser } from "../users/public-user.js";
import { EmailCodeService } from "./email-code.service.js";
import { PasswordService } from "./password.service.js";
import { RefreshTokenService } from "./refresh-token.service.js";

/** Kod błędu Prismy dla naruszenia ograniczenia unikalności. */
const UNIQUE_VIOLATION = "P2002";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly db: Db,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly emailCodes: EmailCodeService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  /** Zakłada konto i od razu loguje (bez osobnego kroku logowania w UI). */
  async register(input: RegisterInput): Promise<AuthSession> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      // Bez wcześniejszego findUnique "czy e-mail zajęty": między
      // sprawdzeniem a INSERT-em ktoś mógłby założyć to samo konto.
      // Unikalny indeks w bazie jest jedynym źródłem prawdy.
      const user = await this.db.user.create({
        data: { email: input.email, passwordHash },
      });
      // Kod potwierdzający adres. Awaria wysyłki nie blokuje konta — appka
      // pozwoli wysłać kod ponownie.
      await this.emailCodes.send(user, "EMAIL_VERIFICATION").catch((error: unknown) => {
        this.logger.error("Verification e-mail not sent after registration", error);
      });
      return await this.createSession(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException("Email already registered");
      }
      throw error;
    }
  }

  /**
   * Loguje e-mailem i hasłem. Ten sam komunikat i ten sam czas odpowiedzi
   * dla "nie ma takiego konta" i "złe hasło" — żeby nie dało się
   * odpytywać, kto jest zarejestrowany.
   */
  async login(input: LoginInput): Promise<AuthSession> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const valid = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user || !valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (this.passwords.needsRehash(user.passwordHash)) {
      // Jedyny moment, gdy mamy hasło w postaci jawnej — okazja, żeby
      // przeliczyć hash na aktualne parametry argon2.
      await this.db.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.passwords.hash(input.password) },
      });
    }
    return this.createSession(user);
  }

  /** Rotacja: stary refresh token → nowa para tokenów. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    return {
      accessToken: await this.signAccessToken(rotated.userId),
      refreshToken: rotated.refreshToken,
      accessTokenExpiresIn: this.accessTtl(),
    };
  }

  /**
   * „Nie pamiętam hasła”. Zawsze ta sama odpowiedź i bez czekania na
   * wysyłkę — ani treść, ani czas odpowiedzi nie zdradzają, kto ma konto.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return;
    void this.emailCodes.send(user, "PASSWORD_RESET").catch((error: unknown) => {
      this.logger.error("Password reset e-mail not sent", error);
    });
  }

  /**
   * Nowe hasło z kodem z e-maila. Kończy wszystkie sesje (ktoś mógł znać
   * stare hasło) i potwierdza adres — kod doszedł na tę skrzynkę. Nieznany
   * adres to ten sam błąd co zły kod.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await this.emailCodes.consume(user.id, "PASSWORD_RESET", input.code))) {
      throw new BadRequestException("Invalid or expired code");
    }
    const passwordHash = await this.passwords.hash(input.password);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      });
      await this.refreshTokens.revokeAllForUser(user.id, tx);
    });
  }

  /**
   * Zmiana hasła po zalogowaniu. Wszystkie sesje się kończą, a ten telefon
   * dostaje nową — nie musi logować się od nowa. Złe obecne hasło to 403
   * (jak przy usuwaniu konta), nie 401, które kazałoby odświeżyć sesję.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<AuthTokens> {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await this.passwords.verify(user.passwordHash, input.currentPassword))) {
      throw new ForbiddenException("Invalid password");
    }
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.refreshTokens.revokeAllForUser(userId, tx);
    });
    const { user: _user, ...tokens } = await this.createSession(user);
    return tokens;
  }

  /** Wylogowanie z bieżącej sesji (unieważnia rodzinę refresh tokena). */
  logout(refreshToken: string): Promise<void> {
    return this.refreshTokens.revoke(refreshToken);
  }

  private async createSession(user: User): Promise<AuthSession> {
    return {
      user: toPublicUser(user),
      accessToken: await this.signAccessToken(user.id),
      refreshToken: await this.refreshTokens.issueForNewSession(user.id),
      accessTokenExpiresIn: this.accessTtl(),
    };
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }

  private accessTtl(): number {
    return this.config.get("JWT_ACCESS_TTL_SECONDS", { infer: true });
  }
}
