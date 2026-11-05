import type { PublicUser } from "@vireo/shared";
import request from "supertest";

import { CLOCK } from "../src/common/clock.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { MAILER } from "../src/mail/mailer.js";
import type { TestApp, TestSession } from "./helpers.js";
import {
  CapturingMailer,
  createTestApp,
  createTestDb,
  registerUser,
  resetDb,
  TEST_PASSWORD,
  TestClock,
} from "./helpers.js";

/**
 * Zmiana adresu e-mail: nowy adres + hasło → kod na NOWY adres → kod
 * zmienia adres (od razu potwierdzony), a stary adres dostaje informację.
 * Kod działa tylko dla adresu, na który go wysłano.
 */
describe("Zmiana adresu e-mail (e2e)", () => {
  const clock = new TestClock();
  const mailer = new CapturingMailer();
  let app: TestApp;
  let db: PrismaClient;
  let me: TestSession;

  const NEW = "nowy@example.com";
  const http = () => request(app.getHttpServer());
  const auth = (session: TestSession = me) => ({
    Authorization: `Bearer ${session.accessToken}`,
  });
  const requestChange = (body: object, session: TestSession = me) =>
    http().post("/users/me/email/change").set(auth(session)).send(body);
  const confirm = (code: string, session: TestSession = me) =>
    http().post("/users/me/email/change/confirm").set(auth(session)).send({ code });

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
    mailer.failing = false;
    await resetDb(db);
    me = await registerUser(app);
    mailer.sent = [];
    mailer.attempts = 0;
  });

  it("kod na nowy adres; po nim adres zmieniony i potwierdzony, stary dostaje informację", async () => {
    const old = me.user.email;
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);

    expect(mailer.sent.map((mail) => [mail.to, mail.subject])).toEqual([
      [NEW, "Kod do zmiany adresu e-mail w Finso"],
    ]);
    const res = await confirm(mailer.codeFor(NEW)).expect(200);

    expect(res.body as PublicUser).toMatchObject({ email: NEW, emailVerified: true });
    expect(mailer.sent.at(-1)).toMatchObject({
      to: old,
      subject: "Adres e-mail w Finso zmieniony",
    });
    expect(mailer.sent.at(-1)?.text).toContain(NEW);
    // Logowanie już nowym adresem; stary nie działa.
    await http().post("/auth/login").send({ email: NEW, password: TEST_PASSWORD }).expect(200);
    await http().post("/auth/login").send({ email: old, password: TEST_PASSWORD }).expect(401);
  });

  it("złe hasło → 403, nic nie wysłane", async () => {
    await requestChange({ newEmail: NEW, password: "zle haslo 123" }).expect(403);

    expect(mailer.attempts).toBe(0);
  });

  it("adres zajęty przez inne konto → 409", async () => {
    await registerUser(app, NEW);

    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(409);
  });

  it("ten sam adres co obecny → 400", async () => {
    await requestChange({ newEmail: me.user.email, password: TEST_PASSWORD }).expect(400);
  });

  it("zły albo wygasły kod → 400, adres bez zmian", async () => {
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);
    const code = mailer.codeFor(NEW);

    await confirm(code === "000000" ? "111111" : "000000").expect(400);
    clock.set("2026-10-20T10:31:00Z");
    await confirm(code).expect(400);

    const user = await db.user.findUniqueOrThrow({ where: { id: me.user.id } });
    expect(user.email).toBe(me.user.email);
  });

  it("nowa prośba o inny adres unieważnia poprzedni kod", async () => {
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);
    const first = mailer.codeFor(NEW);
    clock.set("2026-10-20T10:02:00Z");
    await requestChange({ newEmail: "inny@example.com", password: TEST_PASSWORD }).expect(204);

    await confirm(first).expect(400);
    await confirm(mailer.codeFor("inny@example.com")).expect(200);
  });

  it("ktoś zajął adres między kodem a potwierdzeniem → 409, adres bez zmian", async () => {
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);
    const code = mailer.codeFor(NEW);
    await registerUser(app, NEW);

    await confirm(code).expect(409);
  });

  it("kod potwierdzający adres nie zmienia adresu (inny cel kodu)", async () => {
    // Rejestracja wysłała już kod; nowy najwcześniej po minucie.
    clock.set("2026-10-20T10:02:00Z");
    await http().post("/users/me/email/verification").set(auth()).expect(204);
    const verification = mailer.codeFor(me.user.email);
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);

    if (verification !== mailer.codeFor(NEW)) await confirm(verification).expect(400);
  });

  it("e-mail nie wyszedł → 503", async () => {
    mailer.failing = true;

    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(503);
  });

  it("izolacja: kod Alice nie zmienia adresu Boba", async () => {
    const bob = await registerUser(app);
    await requestChange({ newEmail: NEW, password: TEST_PASSWORD }).expect(204);

    await confirm(mailer.codeFor(NEW), bob).expect(400);
  });
});
