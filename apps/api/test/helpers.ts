import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { TEST_DATABASE_URL } from './test-env.js';

/**
 * Surowy klient do przygotowania danych i asercji "co faktycznie jest
 * w bazie" — bez soft-delete extension, więc widzi też miękko usunięte
 * wiersze. Dokładnie tego potrzebujemy, żeby sprawdzić, że usunięcie
 * konta skasowało WSZYSTKO.
 */
export function createTestDb(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
}

/**
 * Buduje aplikację z prawdziwego AppModule — te same globalne guardy,
 * pipe'y i interceptory co na produkcji. `customize` pozwala nadpisać
 * pojedynczy provider (np. limity throttlera).
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<INestApplication> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

/**
 * Czyści wszystkie dane. CASCADE od tabeli User zabiera wszystko, co ma
 * do niej klucz obcy; kategorie systemowe (userId = null) też lecą, bo
 * TRUNCATE ... CASCADE czyści całe tabele zależne, nie tylko powiązane
 * wiersze. Testy, które ich potrzebują, tworzą je same.
 */
export async function resetDb(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
}

let emailCounter = 0;

/** Unikalny e-mail na test — testy nie zależą od kolejności wykonania. */
export function uniqueEmail(): string {
  emailCounter += 1;
  return `user${emailCounter}-${Date.now()}@example.com`;
}

export const TEST_PASSWORD = 'correct horse battery staple';

export interface TestSession {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}

/** Rejestruje nowego użytkownika przez API i zwraca jego sesję. */
export async function registerUser(
  app: INestApplication,
  email = uniqueEmail(),
  password = TEST_PASSWORD,
): Promise<TestSession> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password })
    .expect(201);
  return res.body as TestSession;
}
