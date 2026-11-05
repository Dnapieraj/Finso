import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen } from "expo-router/testing-library";

import { fakeApi, TEST_EMAIL_CODE } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};

async function openChangeEmail() {
  const app = await renderApp("/settings/change-email", { signedIn: true });
  await header("Zmień adres e-mail");
  return app;
}

async function requestCode(email = "nowy@example.com") {
  await type("Nowy adres e-mail", email);
  await type("Hasło", "moje haslo 123");
  await press("Wyślij kod");
}

describe("Ustawienia → Konto → Zmień adres e-mail", () => {
  it("link w części Konto", async () => {
    const app = await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));

    await press("Zmień adres e-mail");

    expect(app).toHavePathname("/settings/change-email");
  });

  it("mówi, jaki jest obecny adres i że kod pójdzie na nowy", async () => {
    await openChangeEmail();

    expect(
      screen.getByText(
        "Obecny adres: ola@example.com. Kod wyślemy na nowy adres — dopiero on zmieni adres konta.",
      ),
    ).toBeOnTheScreen();
  });

  it("krok 1 → kod na nowy adres → krok 2: kod zmienia adres, Ustawienia pokazują nowy", async () => {
    await openChangeEmail();
    await requestCode();

    expect(fakeApi.users.requestEmailChange).toHaveBeenCalledWith({
      newEmail: "nowy@example.com",
      password: "moje haslo 123",
    });
    expect(
      await screen.findByText("Kod wysłaliśmy na nowy@example.com. Wpisz go poniżej."),
    ).toBeOnTheScreen();

    await type("Kod z e-maila", TEST_EMAIL_CODE);
    await press("Zmień adres");

    expect(await header("Ustawienia")).toBeOnTheScreen();
    expect(await screen.findByText("nowy@example.com")).toBeOnTheScreen();
  });

  it("walidacja: zły adres i puste hasło nie idą do API", async () => {
    await openChangeEmail();
    await type("Nowy adres e-mail", "nowy");

    await press("Wyślij kod");

    expect(await screen.findByText("Podaj poprawny adres e-mail.")).toBeOnTheScreen();
    expect(fakeApi.users.requestEmailChange).not.toHaveBeenCalled();
  });

  it.each([
    [403, "Nieprawidłowe hasło."],
    [409, "Konto z tym adresem e-mail już istnieje."],
    [400, "To jest już adres Twojego konta."],
    [503, "Nie udało się wysłać e-maila. Spróbuj za chwilę."],
  ])("krok 1: błąd %i → %s", async (status, message) => {
    fakeApi.users.requestEmailChange.mockRejectedValueOnce(new ApiError("http", status, "x"));
    await openChangeEmail();

    await requestCode();

    expect(await screen.findByText(message)).toBeOnTheScreen();
  });

  it("krok 2: zły kod — komunikat, adres bez zmian", async () => {
    await openChangeEmail();
    await requestCode();
    await type("Kod z e-maila", "000000");

    await press("Zmień adres");

    expect(
      await screen.findByText("Kod jest nieprawidłowy albo wygasł. Sprawdź go albo wyślij nowy."),
    ).toBeOnTheScreen();
  });

  it("krok 2: „Wyślij kod ponownie” ponawia prośbę z tym samym adresem i hasłem", async () => {
    await openChangeEmail();
    await requestCode();
    await screen.findByLabelText("Kod z e-maila");

    await press("Wyślij kod ponownie");

    expect(fakeApi.users.requestEmailChange).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Wysłano nowy kod.")).toBeOnTheScreen();
  });

  it("krok 2: „Zmień adres na inny” wraca do kroku 1", async () => {
    await openChangeEmail();
    await requestCode();

    await press("Inny adres");

    expect(await screen.findByLabelText("Nowy adres e-mail")).toBeOnTheScreen();
  });
});
