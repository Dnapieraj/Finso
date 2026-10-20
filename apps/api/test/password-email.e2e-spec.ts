import type { AuthTokens, PublicUser } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { MailMessage, Mailer } from "../src/mail/mailer.js";
import { MAILER } from "../src/mail/mailer.js";
import type { TestApp, TestSession } from "./helpers.js";
import {
  createTestApp,
  createTestDb,
  registerUser,
  resetDb,
  TEST_PASSWORD,
  TestClock,
} from "./helpers.js";

/** Collects what the API would have e-mailed. */
class CapturingMailer implements Mailer {
  sent: MailMessage[] = [];
  failing = false;
  /** Every send, failed or not — to wait for work the API does after responding. */
  attempts = 0;

  send(message: MailMessage): Promise<void> {
    this.attempts += 1;
    if (this.failing) return Promise.reject(new Error("mail provider down"));
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The 6-digit code from the newest e-mail to `to`. */
  codeFor(to: string): string {
    const mail = this.sent.filter((message) => message.to === to).at(-1);
    const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) throw new Error(`No code e-mailed to ${to}`);
    return code;
  }
}

/** The forgot-password e-mail goes out after the response; give it a moment. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

/**
 * Reset hasła kodem z e-maila, potwierdzenie adresu i zmiana hasła po
 * zalogowaniu. Kod: 6 cyfr, jednorazowy, ważny 15 minut (reset) albo
 * 24 godziny (adres), najwyżej 5 prób. W bazie tylko HMAC kodu.
 */
describe("Hasło i adres e-mail (e2e)", () => {
  const clock = new TestClock();
  const mailer = new CapturingMailer();
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const http = () => request(app.getHttpServer());
  const forgot = (email: string) => http().post("/auth/password/forgot").send({ email });
  const reset = (body: { email: string; code: string; password: string }) =>
    http().post("/auth/password/reset").send(body);
  const login = (password: string) =>
    http().post("/auth/login").send({ email: me.user.email, password });
  const auth = (session: { accessToken: string } = me) => ({
    Authorization: `Bearer ${session.accessToken}`,
  });

  async function requestResetCode(): Promise<string> {
    await forgot(me.user.email).expect(204);
    await vi.waitFor(() => {
      expect(mailer.sent.some((mail) => mail.subject === "Kod do zmiany hasła w Finso")).toBe(true);
    });
    return mailer.codeFor(me.user.email);
  }

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(CLOCK).useValue(clock).overrideProvider(MAILER).useValue(mailer),
    );
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    clock.set("2026-10-20T10:00:00Z");
    mailer.sent = [];
    mailer.failing = false;
    mailer.attempts = 0;
    await resetDb(db);
    me = await registerUser(app);
    mailer.sent = [];
    mailer.attempts = 0;
  });

  describe("„Nie pamiętam hasła”", () => {
    it("wysyła kod na adres konta; nowe hasło działa, stare nie", async () => {
      const code = await requestResetCode();
      expect(mailer.sent).toEqual([
        {
          to: me.user.email,
          subject: "Kod do zmiany hasła w Finso",
          text: expect.stringContaining(code) as unknown,
        },
      ]);

      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(204);

      await login("nowe-haslo-123").expect(200);
      await login(TEST_PASSWORD).expect(401);
    });

    it("reset kończy wszystkie sesje", async () => {
      const code = await requestResetCode();

      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(204);

      await http().post("/auth/refresh").send({ refreshToken: me.refreshToken }).expect(401);
    });

    it("reset potwierdza adres — kod doszedł na tę skrzynkę", async () => {
      const code = await requestResetCode();
      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(204);

      const session = (await login("nowe-haslo-123").expect(200)).body as { user: PublicUser };
      expect(session.user.emailVerified).toBe(true);
    });

    it("nieznany adres: ta sama odpowiedź, ale żaden e-mail nie wychodzi", async () => {
      await forgot("nikt@example.com").expect(204);
      await settle();

      expect(mailer.sent).toEqual([]);
    });

    it("reset na nieznany adres → 400, jak zły kod", async () => {
      await reset({ email: "nikt@example.com", code: "123456", password: "nowe-haslo-123" }).expect(
        400,
      );
    });

    it("kod jest jednorazowy", async () => {
      const code = await requestResetCode();
      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(204);

      await reset({ email: me.user.email, code, password: "inne-haslo-456" }).expect(400);
      await login("nowe-haslo-123").expect(200);
    });

    it("po 15 minutach kod wygasa", async () => {
      const code = await requestResetCode();
      clock.set("2026-10-20T10:15:01Z");

      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(400);
      await login(TEST_PASSWORD).expect(200);
    });

    it("5 złych prób unieważnia kod — zgadywanie nie działa", async () => {
      const code = await requestResetCode();
      const wrong = code === "000000" ? "111111" : "000000";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await reset({ email: me.user.email, code: wrong, password: "nowe-haslo-123" }).expect(400);
      }

      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(400);
      await login(TEST_PASSWORD).expect(200);
    });

    it("ponowna prośba w ciągu minuty nie wysyła drugiego e-maila; później nowy kod zastępuje stary", async () => {
      const first = await requestResetCode();
      await forgot(me.user.email).expect(204);
      await settle();
      expect(mailer.sent).toHaveLength(1);

      clock.set("2026-10-20T10:01:01Z");
      await forgot(me.user.email).expect(204);
      await vi.waitFor(() => {
        expect(mailer.sent).toHaveLength(2);
      });
      const second = mailer.codeFor(me.user.email);

      if (first !== second) {
        await reset({ email: me.user.email, code: first, password: "nowe-haslo-123" }).expect(400);
      }
      await reset({ email: me.user.email, code: second, password: "nowe-haslo-123" }).expect(204);
    });

    it("kod jednego konta nie działa dla drugiego", async () => {
      const other = await registerUser(app);
      const code = await requestResetCode();

      await reset({ email: other.user.email, code, password: "nowe-haslo-123" }).expect(400);
    });

    it("kod potwierdzający adres nie zmienia hasła", async () => {
      clock.set("2026-10-20T10:01:01Z");
      await http().post("/users/me/email/verification").set(auth()).expect(204);
      const code = mailer.codeFor(me.user.email);

      await reset({ email: me.user.email, code, password: "nowe-haslo-123" }).expect(400);
    });

    it("awaria wysyłki nie zdradza niczego — nadal 204", async () => {
      mailer.failing = true;

      await forgot(me.user.email).expect(204);
      // The e-mail goes out after the response; let it fail before the next test.
      await vi.waitFor(() => {
        expect(mailer.attempts).toBe(1);
      });
    });

    it("w bazie nie ma kodu, tylko jego skrót", async () => {
      const code = await requestResetCode();

      const rows = await db.emailCode.findMany({ where: { userId: me.user.id } });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row.codeHash).not.toContain(code);
    });
  });

  describe("potwierdzenie adresu e-mail", () => {
    it("rejestracja wysyła kod; konto jest niepotwierdzone, dopóki nie wpisze się kodu", async () => {
      mailer.sent = [];
      const fresh = await registerUser(app);
      expect(fresh.user.emailVerified).toBe(false);
      expect(mailer.sent).toEqual([
        {
          to: fresh.user.email,
          subject: "Potwierdź adres e-mail w Finso",
          text: expect.stringMatching(/\b\d{6}\b/) as unknown,
        },
      ]);

      const res = await http()
        .post("/users/me/email/verify")
        .set(auth(fresh))
        .send({ code: mailer.codeFor(fresh.user.email) })
        .expect(200);

      expect((res.body as PublicUser).emailVerified).toBe(true);
      const after = await http().get("/users/me").set(auth(fresh)).expect(200);
      expect((after.body as PublicUser).emailVerified).toBe(true);
    });

    it("zły kod → 400, adres dalej niepotwierdzony", async () => {
      await http().post("/users/me/email/verify").set(auth()).send({ code: "999999" }).expect(400);

      const after = await http().get("/users/me").set(auth()).expect(200);
      expect((after.body as PublicUser).emailVerified).toBe(false);
    });

    it("„Wyślij ponownie” wysyła nowy kod (najwyżej raz na minutę)", async () => {
      clock.set("2026-10-20T10:01:01Z");
      await http().post("/users/me/email/verification").set(auth()).expect(204);
      await http().post("/users/me/email/verification").set(auth()).expect(204);

      expect(mailer.sent).toHaveLength(1);
      await http()
        .post("/users/me/email/verify")
        .set(auth())
        .send({ code: mailer.codeFor(me.user.email) })
        .expect(200);
    });

    it("kod wygasa po 24 godzinach", async () => {
      clock.set("2026-10-20T10:01:01Z");
      await http().post("/users/me/email/verification").set(auth()).expect(204);
      const code = mailer.codeFor(me.user.email);
      clock.set("2026-10-21T10:01:02Z");

      await http().post("/users/me/email/verify").set(auth()).send({ code }).expect(400);
    });

    it("potwierdzony adres: nic nie wysyła", async () => {
      await db.user.update({ where: { id: me.user.id }, data: { emailVerifiedAt: new Date() } });

      await http().post("/users/me/email/verification").set(auth()).expect(204);

      expect(mailer.sent).toEqual([]);
    });

    it("awaria wysyłki → 503, żeby appka mogła powiedzieć, że kod nie wyszedł", async () => {
      clock.set("2026-10-20T10:01:01Z");
      mailer.failing = true;

      await http().post("/users/me/email/verification").set(auth()).expect(503);
    });

    it("awaria wysyłki przy rejestracji nie blokuje założenia konta", async () => {
      mailer.failing = true;

      const fresh = await registerUser(app);

      expect(fresh.user.emailVerified).toBe(false);
    });

    it("bez tokena → 401", async () => {
      await http().post("/users/me/email/verify").send({ code: "123456" }).expect(401);
    });
  });

  describe("zmiana hasła po zalogowaniu", () => {
    const change = (body: object, session = me) =>
      http().post("/users/me/password").set(auth(session)).send(body);

    it("z obecnym hasłem: nowe tokeny dla tego telefonu, inne sesje się kończą", async () => {
      const otherPhone = (await login(TEST_PASSWORD).expect(200)).body as AuthTokens;

      const res = await change({
        currentPassword: TEST_PASSWORD,
        newPassword: "nowe-haslo-123",
      }).expect(200);

      const tokens = res.body as AuthTokens;
      await http().get("/users/me").set(auth(tokens)).expect(200);
      await http().post("/auth/refresh").send({ refreshToken: tokens.refreshToken }).expect(200);
      await http().post("/auth/refresh").send({ refreshToken: me.refreshToken }).expect(401);
      await http()
        .post("/auth/refresh")
        .send({ refreshToken: otherPhone.refreshToken })
        .expect(401);
      await login("nowe-haslo-123").expect(200);
    });

    it("złe obecne hasło → 403 i nic się nie zmienia", async () => {
      await change({ currentPassword: "zle-haslo", newPassword: "nowe-haslo-123" }).expect(403);

      await login(TEST_PASSWORD).expect(200);
      await http().post("/auth/refresh").send({ refreshToken: me.refreshToken }).expect(200);
    });

    it("za krótkie nowe hasło → 400", async () => {
      await change({ currentPassword: TEST_PASSWORD, newPassword: "krotkie" }).expect(400);
    });
  });
});
