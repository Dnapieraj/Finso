import type { Server } from "node:http";

import type { INestApplication } from "@nestjs/common";
import type { TestingModuleBuilder } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { PrismaPg } from "@prisma/adapter-pg";
import request from "supertest";

import { AppModule } from "../src/app.module.js";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { TEST_DATABASE_URL } from "./test-env.js";

/**
 * Surowy klient do przygotowania danych i asercji "co faktycznie jest
 * w bazie" — bez soft-delete extension, więc widzi też miękko usunięte
 * wiersze. Dokładnie tego potrzebujemy, żeby sprawdzić, że usunięcie
 * konta skasowało WSZYSTKO.
 */
export function createTestDb(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }) });
}

/** Aplikacja z typowanym serwerem HTTP — `getHttpServer()` nie zwraca `any`. */
export type TestApp = INestApplication<Server>;

/**
 * `id` z odpowiedzi — najczęstszy odczyt w testach. Supertest typuje
 * `res.body` jako `any`, więc testy rzutują je jawnie na oczekiwany typ.
 */
export function idOf(res: { body: unknown }): string {
  return (res.body as { id: string }).id;
}

/** Odpowiedź 400 z ZodValidationPipe. */
export interface ValidationErrorBody {
  message: string;
  errors: { code: string; path: (string | number)[]; message: string }[];
}

/**
 * `expect.any(String)` jako `unknown`: sam matcher jest typowany jako
 * `any`, co w literałach obiektów wyłącza sprawdzanie typów.
 */
export const anyString: unknown = expect.any(String);

/** `expect.arrayContaining` jako `unknown` — z tego samego powodu co {@link anyString}. */
export function arrayContaining(items: unknown[]): unknown {
  return expect.arrayContaining(items);
}

/**
 * Buduje aplikację z prawdziwego AppModule — te same globalne guardy,
 * pipe'y i interceptory co na produkcji. `customize` pozwala nadpisać
 * pojedynczy provider (np. limity throttlera).
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<TestApp>();
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
  return `user${String(emailCounter)}-${String(Date.now())}@example.com`;
}

export const TEST_PASSWORD = "correct horse battery staple";

export interface TestSession {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
}

/** Rejestruje nowego użytkownika przez API i zwraca jego sesję. */
export async function registerUser(
  app: TestApp,
  email = uniqueEmail(),
  password = TEST_PASSWORD,
): Promise<TestSession> {
  const res = await request(app.getHttpServer())
    .post("/auth/register")
    .send({ email, password })
    .expect(201);
  return res.body as TestSession;
}
