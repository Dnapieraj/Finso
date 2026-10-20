import { validateEnv } from "./env.js";

const base = {
  DATABASE_URL: "postgresql://finso:finso@localhost:5432/finso",
  JWT_ACCESS_SECRET: "x".repeat(32),
  EMAIL_CODE_SECRET: "y".repeat(32),
};

describe("validateEnv", () => {
  it("lokalnie bez klucza Resend: kody trafiają do logu, nadawca domyślny", () => {
    const env = validateEnv(base);

    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.MAIL_FROM).toBe("Finso <kontakt@finso.app>");
  });

  it("produkcja bez klucza Resend nie startuje — e-maile nie mogą po cichu znikać", () => {
    expect(() => validateEnv({ ...base, NODE_ENV: "production" })).toThrow(/RESEND_API_KEY/);
  });

  it("produkcja z kluczem Resend startuje", () => {
    expect(
      validateEnv({ ...base, NODE_ENV: "production", RESEND_API_KEY: "re_123" }).RESEND_API_KEY,
    ).toBe("re_123");
  });

  it("sekret kodów e-mail musi mieć co najmniej 32 znaki", () => {
    expect(() => validateEnv({ ...base, EMAIL_CODE_SECRET: "krotki" })).toThrow(
      /EMAIL_CODE_SECRET/,
    );
  });
});
