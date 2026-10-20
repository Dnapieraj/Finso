import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  deleteAccountSchema,
  emailCodeSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./schemas.js";

describe("emailSchema", () => {
  it("normalizuje e-mail: przycina spacje i zamienia na małe litery", () => {
    // Bez tego "Jan@Example.com" i "jan@example.com" to dwa konta,
    // a użytkownik nie może się zalogować, bo raz wpisał wielką literę.
    expect(emailSchema.parse("  Jan.Kowalski@Example.COM ")).toBe("jan.kowalski@example.com");
  });

  it("odrzuca niepoprawny e-mail", () => {
    expect(emailSchema.safeParse("to-nie-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("odrzuca e-mail dłuższy niż 254 znaki (limit RFC 5321)", () => {
    const local = "a".repeat(64);
    const domain = `${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.pl`;
    expect(`${local}@${domain}`.length).toBeGreaterThan(254);
    expect(emailSchema.safeParse(`${local}@${domain}`).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = { email: "jan@example.com", password: "a".repeat(PASSWORD_MIN_LENGTH) };

  it("akceptuje hasło o minimalnej długości", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("odrzuca hasło krótsze niż minimum", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
    });
    expect(result.success).toBe(false);
  });

  it("odrzuca hasło dłuższe niż maksimum", () => {
    // Górny limit chroni serwer: argon2 na megabajtowym "haśle" to
    // tani sposób na zajęcie CPU.
    const result = registerSchema.safeParse({
      ...valid,
      password: "a".repeat(PASSWORD_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("nie przycina hasła — spacje na końcu są częścią hasła", () => {
    const result = registerSchema.parse({ ...valid, password: " secret pass " });
    expect(result.password).toBe(" secret pass ");
  });

  it("usuwa nieznane pola (np. próbę ustawienia planu PLUS przy rejestracji)", () => {
    const result = registerSchema.parse({ ...valid, plan: "PLUS" });
    expect(result).toEqual({ email: valid.email, password: valid.password });
  });
});

describe("loginSchema", () => {
  it("nie wymaga minimalnej długości hasła — to nie miejsce na politykę haseł", () => {
    // Gdybyśmy kiedyś podnieśli minimum, starzy użytkownicy nadal muszą
    // móc się zalogować. Przy logowaniu hasło jest tylko porównywane.
    expect(loginSchema.safeParse({ email: "jan@example.com", password: "x" }).success).toBe(true);
  });

  it("odrzuca puste hasło", () => {
    expect(loginSchema.safeParse({ email: "jan@example.com", password: "" }).success).toBe(false);
  });
});

describe("refreshTokenSchema", () => {
  it("wymaga niepustego tokena", () => {
    expect(refreshTokenSchema.safeParse({ refreshToken: "" }).success).toBe(false);
    expect(refreshTokenSchema.safeParse({}).success).toBe(false);
    expect(refreshTokenSchema.safeParse({ refreshToken: "abc" }).success).toBe(true);
  });
});

describe("deleteAccountSchema", () => {
  it("wymaga hasła", () => {
    expect(deleteAccountSchema.safeParse({}).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ password: "x" }).success).toBe(true);
  });
});

describe("emailCodeSchema", () => {
  it.each(["123456", " 012345 "])("przyjmuje 6 cyfr (%s), bez spacji na brzegach", (code) => {
    expect(emailCodeSchema.parse(code)).toBe(code.trim());
  });

  it.each(["12345", "1234567", "12a456", "", "12 456"])("odrzuca %s", (code) => {
    expect(emailCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("normalizuje e-mail", () => {
    expect(forgotPasswordSchema.parse({ email: " Ola@Example.com " })).toEqual({
      email: "ola@example.com",
    });
  });
});

describe("resetPasswordSchema", () => {
  const valid = { email: "ola@example.com", code: "123456", password: "nowe-haslo-1" };

  it("przyjmuje e-mail, kod i nowe hasło", () => {
    expect(resetPasswordSchema.parse(valid)).toEqual(valid);
  });

  it("nowe hasło podlega polityce długości", () => {
    expect(
      resetPasswordSchema.safeParse({ ...valid, password: "x".repeat(PASSWORD_MIN_LENGTH - 1) })
        .success,
    ).toBe(false);
  });

  it("zły kod → odrzucony", () => {
    expect(resetPasswordSchema.safeParse({ ...valid, code: "abc" }).success).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("wymaga kodu", () => {
    expect(verifyEmailSchema.parse({ code: "654321" })).toEqual({ code: "654321" });
    expect(verifyEmailSchema.safeParse({}).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("obecne hasło bez polityki, nowe z polityką", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "nowe-haslo-1" }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "krotkie" }).success,
    ).toBe(false);
  });
});
