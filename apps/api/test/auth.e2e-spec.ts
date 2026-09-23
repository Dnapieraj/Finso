import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';

import type { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createTestApp,
  createTestDb,
  registerUser,
  resetDb,
  TEST_PASSWORD,
  uniqueEmail,
} from './helpers.js';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let db: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    db = createTestDb();
  });

  afterAll(async () => {
    await app.close();
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
  });

  const http = () => request(app.getHttpServer());

  describe('POST /auth/register', () => {
    it('zakłada konto i zwraca sesję bez hasha hasła', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: '  Nowy.User@Example.COM ', password: TEST_PASSWORD })
        .expect(201);

      expect(res.body).toEqual({
        user: {
          id: expect.any(String),
          email: 'nowy.user@example.com',
          plan: 'FREE',
          currency: 'PLN',
          timezone: 'Europe/Warsaw',
        },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        accessTokenExpiresIn: 900,
      });
      expect(JSON.stringify(res.body)).not.toContain('argon2');
    });

    it('zapisuje hasło jako hash argon2id, nigdy jawnie', async () => {
      await http()
        .post('/auth/register')
        .send({ email: 'hash@example.com', password: TEST_PASSWORD })
        .expect(201);

      const user = await db.user.findUniqueOrThrow({ where: { email: 'hash@example.com' } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(TEST_PASSWORD);
    });

    it('zapisuje refresh token jako hash, nie w postaci jawnej', async () => {
      const session = await registerUser(app);

      const tokens = await db.refreshToken.findMany();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.tokenHash).not.toBe(session.refreshToken);
    });

    it('odrzuca zajęty e-mail (bez względu na wielkość liter) kodem 409', async () => {
      await registerUser(app, 'zajety@example.com');

      await http()
        .post('/auth/register')
        .send({ email: 'ZAJETY@example.com', password: TEST_PASSWORD })
        .expect(409);
    });

    it('odrzuca za krótkie hasło kodem 400 i nie odsyła hasła w błędzie', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'krotkie' })
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors[0]).toMatchObject({ code: 'too_small', path: ['password'] });
      expect(JSON.stringify(res.body)).not.toContain('krotkie');
    });

    it('odrzuca niepoprawny e-mail i brak body kodem 400', async () => {
      await http().post('/auth/register').send({ email: 'nie-email', password: TEST_PASSWORD }).expect(400);
      await http().post('/auth/register').expect(400);
    });

    it('ignoruje pola spoza schematu (nie da się założyć konta z planem PLUS)', async () => {
      const res = await http()
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: TEST_PASSWORD, plan: 'PLUS' })
        .expect(201);

      expect(res.body.user.plan).toBe('FREE');
    });
  });

  describe('POST /auth/login', () => {
    it('loguje poprawnym hasłem, e-mail bez względu na wielkość liter', async () => {
      await registerUser(app, 'login@example.com');

      const res = await http()
        .post('/auth/login')
        .send({ email: 'LOGIN@example.com', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
    });

    it('każde logowanie to nowa, niezależna sesja (rodzina tokenów)', async () => {
      await registerUser(app, 'multi@example.com');
      await http().post('/auth/login').send({ email: 'multi@example.com', password: TEST_PASSWORD }).expect(200);

      const families = await db.refreshToken.groupBy({ by: ['familyId'] });
      expect(families).toHaveLength(2);
    });

    it('zwraca identyczną odpowiedź 401 dla złego hasła i nieistniejącego konta', async () => {
      await registerUser(app, 'exists@example.com');

      const wrongPassword = await http()
        .post('/auth/login')
        .send({ email: 'exists@example.com', password: 'wrong password' })
        .expect(401);
      const unknownEmail = await http()
        .post('/auth/login')
        .send({ email: 'ghost@example.com', password: 'wrong password' })
        .expect(401);

      // Różne komunikaty zdradziłyby, które e-maile mają konto.
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });
  });

  describe('globalny JwtAuthGuard', () => {
    it('przepuszcza endpointy @Public() bez tokena', async () => {
      await http().get('/health').expect(200, { status: 'ok' });
    });

    it('odrzuca chroniony endpoint bez tokena', async () => {
      await http().get('/users/me').expect(401);
    });

    it('przepuszcza z ważnym access tokenem i rozpoznaje użytkownika', async () => {
      const session = await registerUser(app);

      const res = await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect(res.body.id).toBe(session.user.id);
    });

    it('odrzuca token podpisany innym kluczem', async () => {
      const session = await registerUser(app);
      const forged = new JwtService({ secret: 'a-completely-different-secret-of-32+-chars' });
      const token = await forged.signAsync({ sub: session.user.id });

      await http().get('/users/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it('odrzuca token z alg "none" (bez podpisu)', async () => {
      const session = await registerUser(app);
      const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: session.user.id })}.`;

      await http().get('/users/me').set('Authorization', `Bearer ${unsigned}`).expect(401);
    });

    it('odrzuca wygasły access token', async () => {
      const session = await registerUser(app);
      const signer = new JwtService({ secret: JWT_SECRET });
      const expired = await signer.signAsync(
        { sub: session.user.id, exp: Math.floor(Date.now() / 1000) - 10 },
      );

      await http().get('/users/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });

    it('odrzuca refresh token użyty jako access token', async () => {
      const session = await registerUser(app);

      await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${session.refreshToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh — rotacja', () => {
    it('wymienia refresh token na nową parę tokenów', async () => {
      const session = await registerUser(app);

      const res = await http()
        .post('/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      expect(res.body).toEqual({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        accessTokenExpiresIn: 900,
      });
      expect(res.body.refreshToken).not.toBe(session.refreshToken);
      await http()
        .get('/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);
    });

    it('nowy token należy do tej samej rodziny, stary jest unieważniony', async () => {
      const session = await registerUser(app);
      await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);

      const tokens = await db.refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
      expect(tokens).toHaveLength(2);
      expect(tokens[0]?.familyId).toBe(tokens[1]?.familyId);
      expect(tokens[0]?.revokedAt).not.toBeNull();
      expect(tokens[1]?.revokedAt).toBeNull();
    });

    it('ponowne użycie zrotowanego tokena unieważnia całą rodzinę', async () => {
      // Scenariusz kradzieży: atakujący skopiował token A. Ofiara
      // odświeża pierwsza (A → B). Atakujący próbuje użyć A.
      const session = await registerUser(app);
      const tokenA = session.refreshToken;
      const rotated = await http().post('/auth/refresh').send({ refreshToken: tokenA }).expect(200);
      const tokenB = rotated.body.refreshToken as string;

      await http().post('/auth/refresh').send({ refreshToken: tokenA }).expect(401);

      // B też jest spalony — nie wiemy, kto jest ofiarą, a kto złodziejem,
      // więc sesja kończy się dla obu. Ofiara zaloguje się ponownie.
      await http().post('/auth/refresh').send({ refreshToken: tokenB }).expect(401);
    });

    it('wykrycie kradzieży w jednej sesji nie wylogowuje innych urządzeń', async () => {
      const phone = await registerUser(app, 'devices@example.com');
      const laptop = await http()
        .post('/auth/login')
        .send({ email: 'devices@example.com', password: TEST_PASSWORD })
        .expect(200);

      await http().post('/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(200);
      await http().post('/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401);

      await http()
        .post('/auth/refresh')
        .send({ refreshToken: laptop.body.refreshToken })
        .expect(200);
    });

    it('przy równoczesnym użyciu tego samego tokena tylko jedno żądanie wygrywa', async () => {
      const session = await registerUser(app);

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          http().post('/auth/refresh').send({ refreshToken: session.refreshToken }),
        ),
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses.filter((s) => s === 200)).toHaveLength(1);
      expect(statuses.filter((s) => s === 401)).toHaveLength(4);
    });

    it('odrzuca wygasły refresh token', async () => {
      const session = await registerUser(app);
      await db.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    });

    it('odrzuca nieznany token i access token podany jako refresh', async () => {
      const session = await registerUser(app);

      await http().post('/auth/refresh').send({ refreshToken: 'nie-istnieje' }).expect(401);
      await http().post('/auth/refresh').send({ refreshToken: session.accessToken }).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('unieważnia refresh token — potem nie da się odświeżyć sesji', async () => {
      const session = await registerUser(app);

      await http().post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(204);
      await http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
    });

    it('unieważnia całą sesję, także tokeny po rotacji', async () => {
      const session = await registerUser(app);
      const rotated = await http()
        .post('/auth/refresh')
        .send({ refreshToken: session.refreshToken })
        .expect(200);

      // Klient wylogowuje się aktualnym tokenem.
      await http().post('/auth/logout').send({ refreshToken: rotated.body.refreshToken }).expect(204);

      const active = await db.refreshToken.count({ where: { revokedAt: null } });
      expect(active).toBe(0);
    });

    it('nie wylogowuje innych urządzeń', async () => {
      const phone = await registerUser(app, 'logout-devices@example.com');
      const laptop = await http()
        .post('/auth/login')
        .send({ email: 'logout-devices@example.com', password: TEST_PASSWORD })
        .expect(200);

      await http().post('/auth/logout').send({ refreshToken: phone.refreshToken }).expect(204);

      await http()
        .post('/auth/refresh')
        .send({ refreshToken: laptop.body.refreshToken })
        .expect(200);
    });

    it('jest idempotentne — nieznany token to też 204', async () => {
      await http().post('/auth/logout').send({ refreshToken: 'nie-istnieje' }).expect(204);
    });
  });
});

describe('Rate limiting /auth/* (e2e)', () => {
  const LIMIT = 3;
  let app: INestApplication;

  beforeAll(async () => {
    // Nadpisujemy opcje throttlera zamiast zmiennych środowiskowych:
    // ConfigModule czyta env raz, przy imporcie AppModule.
    app = await createTestApp((builder) =>
      builder
        .overrideProvider(getOptionsToken())
        .useValue({ throttlers: [{ ttl: 60_000, limit: LIMIT }] }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it(`po ${LIMIT} próbach logowania zwraca 429`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'brute@example.com', password: 'guess' });

    for (let i = 0; i < LIMIT; i += 1) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });

  it('nie limituje endpointów spoza auth', async () => {
    for (let i = 0; i < LIMIT + 2; i += 1) {
      await request(app.getHttpServer()).get('/health').expect(200);
    }
  });
});
