import request from "supertest";

import type { TestApp } from "./helpers.js";
import { createTestApp } from "./helpers.js";

/**
 * Zbyt stara appka dostaje 426 na każde żądanie i pokazuje „Zaktualizuj
 * aplikację”. Minimalna wersja z MIN_APP_VERSION (w testach 1.0.0).
 * Brak albo nieczytelny nagłówek nie blokuje — błąd po stronie appki nie
 * może odciąć użytkownika od danych.
 */
describe("Minimalna wersja appki (e2e)", () => {
  let app: TestApp;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("starsza wersja → 426 z minimalną wersją, także na publicznych endpointach", async () => {
    const res = await http()
      .post("/auth/login")
      .set("X-App-Version", "0.9.9")
      .send({ email: "ola@example.com", password: "x" })
      .expect(426);

    expect(res.body).toEqual({
      statusCode: 426,
      message: "update_required",
      minimumVersion: "1.0.0",
    });
  });

  it("starsza wersja → 426 przed sprawdzeniem tokena", async () => {
    await http().get("/users/me").set("X-App-Version", "0.1.0").expect(426);
  });

  it.each([["1.0.0"], ["1.0.1"], ["2.0.0"]])("wersja %s przechodzi dalej", async (version) => {
    await http().get("/users/me").set("X-App-Version", version).expect(401);
  });

  it.each([
    ["brak nagłówka", undefined],
    ["nieczytelna wersja", "dev"],
  ])("%s → przechodzi dalej", async (_case, version) => {
    const req = http().get("/users/me");
    if (version !== undefined) void req.set("X-App-Version", version);
    await req.expect(401);
  });

  it("/health odpowiada zawsze — appka sprawdza nim, czy jest internet", async () => {
    await http().get("/health").set("X-App-Version", "0.1.0").expect(200);
  });
});
