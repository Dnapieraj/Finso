import { deleteAccountSchema, loginSchema, registerSchema } from "@vireo/shared";

import type { z } from "zod";

import { plErrorMap } from "../src/forms/error-map";

/** First Polish message per field, as the forms show them. */
function messages(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input, { error: plErrorMap });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.toReversed().map((issue) => [issue.path.join("."), issue.message]),
  );
}

// The shared schemas carry no messages (only Zod issue codes), so every
// text the user sees comes from this map.
it.each([
  ["empty email", loginSchema, { email: "", password: "x" }, { email: "Podaj adres e-mail." }],
  ["only spaces", loginSchema, { email: "   ", password: "x" }, { email: "Podaj adres e-mail." }],
  [
    "malformed email",
    loginSchema,
    { email: "ola@", password: "x" },
    { email: "Podaj poprawny adres e-mail." },
  ],
  ["empty password on login", loginSchema, { email: "ola@example.com", password: "" }, { password: "Podaj hasło." }],
  [
    "short password on register",
    registerSchema,
    { email: "ola@example.com", password: "1234567" },
    { password: "Hasło musi mieć co najmniej 8 znaków." },
  ],
  [
    "too long password",
    registerSchema,
    { email: "ola@example.com", password: "x".repeat(129) },
    { password: "Hasło może mieć najwyżej 128 znaków." },
  ],
  ["empty password on account deletion", deleteAccountSchema, { password: "" }, { password: "Podaj hasło." }],
])("%s", (_case, schema, input, expected) => {
  expect(messages(schema, input)).toEqual(expected);
});

it("accepts an email with spaces and capitals — the schema normalises it", () => {
  const result = loginSchema.safeParse(
    { email: "  Ola@Example.COM ", password: "x" },
    { error: plErrorMap },
  );

  expect(result.data?.email).toBe("ola@example.com");
});
