import { ApiError } from "@vireo/shared/api";

import { apiErrorMessage } from "../src/auth/api-error-message";

const GENERIC = "Coś poszło nie tak. Spróbuj ponownie.";

it.each([
  ["login", new ApiError("http", 401, "Invalid email or password"), "Nieprawidłowy e-mail lub hasło."],
  ["register", new ApiError("http", 409, "Email already registered"), "Konto z tym adresem e-mail już istnieje."],
  ["delete-account", new ApiError("http", 403, "Invalid password"), "Nieprawidłowe hasło."],
  // Outside login a 401 means the refresh failed too — the session is gone.
  ["delete-account", new ApiError("http", 401, "Unauthorized"), "Sesja wygasła. Zaloguj się ponownie."],
  ["login", new ApiError("http", 429, "Too Many Requests"), "Za dużo prób. Odczekaj chwilę i spróbuj ponownie."],
  ["delete-account", new ApiError("http", 429, "Too Many Requests"), "Za dużo prób. Odczekaj chwilę i spróbuj ponownie."],
  ["register", new ApiError("network", null, "Network request failed"), "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie."],
  ["login", new ApiError("http", 500, "HTTP 500"), GENERIC],
  // Validation happens in the form; a 400 means app and API disagree.
  ["register", new ApiError("http", 400, "Zły e-mail"), GENERIC],
  ["login", new ApiError("invalid-response", 200, "Response does not match the schema"), GENERIC],
  ["login", new TypeError("x is undefined"), GENERIC],
] as const)("%s: %o → %s", (action, error, expected) => {
  expect(apiErrorMessage(error, action)).toBe(expected);
});

it("never shows the raw API message to the user", () => {
  const error = new ApiError("http", 409, "Email already registered");

  expect(apiErrorMessage(error, "login")).not.toContain("Email already registered");
});
