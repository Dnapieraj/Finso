import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, startUnverified, TEST_EMAIL_CODE } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};
const header = (name: string) => screen.findByRole("header", { name });

describe("„Nie pamiętam hasła”", () => {
  async function openForgot() {
    const app = await renderApp("/login", { signedIn: false });
    await header("Zaloguj się");
    await fireEvent.press(await screen.findByRole("link", { name: "Nie pamiętam hasła" }));
    await header("Nie pamiętam hasła");
    return app;
  }

  async function requestCode() {
    await type("E-mail", " Ola@Example.com ");
    await press("Wyślij kod");
    await screen.findByLabelText("Kod z e-maila");
  }

  it("e-mail → kod i nowe hasło → logowanie z komunikatem", async () => {
    const app = await openForgot();

    await requestCode();
    expect(fakeApi.auth.forgotPassword).toHaveBeenCalledWith("ola@example.com");
    expect(
      screen.getByText(
        "Jeśli konto z adresem ola@example.com istnieje, wysłaliśmy na nie 6-cyfrowy kod. Sprawdź też folder spam.",
      ),
    ).toBeOnTheScreen();

    await type("Kod z e-maila", TEST_EMAIL_CODE);
    await type("Nowe hasło", "nowe-haslo-123");
    await press("Ustaw nowe hasło");

    await waitFor(() => {
      expect(app).toHavePathname("/login");
    });
    expect(fakeApi.auth.resetPassword).toHaveBeenCalledWith({
      email: "ola@example.com",
      code: TEST_EMAIL_CODE,
      password: "nowe-haslo-123",
    });
    expect(await screen.findByText("Hasło zmienione. Zaloguj się nowym hasłem.")).toBeOnTheScreen();
  });

  it("zły albo wygasły kod — mówi to wprost", async () => {
    await openForgot();
    await requestCode();

    await type("Kod z e-maila", "000000");
    await type("Nowe hasło", "nowe-haslo-123");
    await press("Ustaw nowe hasło");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kod jest nieprawidłowy albo wygasł. Sprawdź go albo wyślij nowy.",
    );
  });

  it("walidacja: 6 cyfr i hasło według polityki, bez wywołania API", async () => {
    await openForgot();
    await requestCode();

    await type("Kod z e-maila", "12a");
    await type("Nowe hasło", "krotkie");
    await press("Ustaw nowe hasło");

    expect(await screen.findByText("Wpisz 6 cyfr z e-maila.")).toBeOnTheScreen();
    expect(screen.getByText("Hasło musi mieć co najmniej 8 znaków.")).toBeOnTheScreen();
    expect(fakeApi.auth.resetPassword).not.toHaveBeenCalled();
  });

  it("niepoprawny e-mail nie wysyła prośby", async () => {
    await openForgot();

    await type("E-mail", "ola@");
    await press("Wyślij kod");

    expect(await screen.findByText("Podaj poprawny adres e-mail.")).toBeOnTheScreen();
    expect(fakeApi.auth.forgotPassword).not.toHaveBeenCalled();
  });

  it("„Wyślij kod ponownie” prosi o nowy kod", async () => {
    await openForgot();
    await requestCode();

    await press("Wyślij kod ponownie");

    await waitFor(() => {
      expect(fakeApi.auth.forgotPassword).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Wysłano nowy kod.")).toBeOnTheScreen();
  });

  it("za dużo prób → komunikat o limicie", async () => {
    fakeApi.auth.forgotPassword.mockRejectedValueOnce(new ApiError("http", 429, "Too Many"));
    await openForgot();

    await type("E-mail", "ola@example.com");
    await press("Wyślij kod");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.",
    );
  });
});

describe("potwierdzenie adresu e-mail", () => {
  it("Dashboard prosi o potwierdzenie, dopóki adres jest niepotwierdzony", async () => {
    startUnverified();
    const app = await renderApp("/", { signedIn: true });

    expect(await header("Potwierdź adres e-mail")).toBeOnTheScreen();
    await press("Potwierdź adres");

    expect(app).toHavePathname("/settings/verify-email");
  });

  it("potwierdzony adres: bez karty na Dashboardzie", async () => {
    await renderApp("/", { signedIn: true });
    await header("Twój budżet");

    expect(screen.queryByRole("header", { name: "Potwierdź adres e-mail" })).toBeNull();
  });

  it("kod z e-maila potwierdza adres; Ustawienia i Dashboard to widzą", async () => {
    startUnverified();
    await renderApp("/settings", { signedIn: true });
    expect(await screen.findByText("Adres niepotwierdzony")).toBeOnTheScreen();

    await press("Potwierdź adres");
    await header("Potwierdź adres e-mail");
    await type("Kod z e-maila", TEST_EMAIL_CODE);
    await press("Potwierdź");

    expect(fakeApi.users.verifyEmail).toHaveBeenCalledWith(TEST_EMAIL_CODE);
    await waitFor(() => {
      expect(screen.getByText("Adres potwierdzony")).toBeOnTheScreen();
    });
    await fireEvent.press(await findTab("Start"));
    await header("Twój budżet");
    expect(screen.queryByRole("header", { name: "Potwierdź adres e-mail" })).toBeNull();
  });

  it("zły kod — komunikat, adres dalej niepotwierdzony", async () => {
    startUnverified();
    await renderApp("/settings/verify-email", { signedIn: true });

    await type("Kod z e-maila", "000000");
    await press("Potwierdź");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kod jest nieprawidłowy albo wygasł. Sprawdź go albo wyślij nowy.",
    );
  });

  it("„Wyślij kod ponownie” — potwierdzenie albo błąd wysyłki", async () => {
    startUnverified();
    await renderApp("/settings/verify-email", { signedIn: true });
    expect(
      await screen.findByText("Kod wysłaliśmy na ola@example.com przy zakładaniu konta.", {
        exact: false,
      }),
    ).toBeOnTheScreen();

    await press("Wyślij kod ponownie");
    expect(await screen.findByText("Wysłano nowy kod.")).toBeOnTheScreen();

    fakeApi.users.sendEmailVerification.mockRejectedValueOnce(
      new ApiError("http", 503, "Verification e-mail not sent"),
    );
    await press("Wyślij kod ponownie");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się wysłać e-maila. Spróbuj za chwilę.",
    );
  });

  it("potwierdzony adres: Ustawienia nie proponują potwierdzania", async () => {
    await renderApp("/settings", { signedIn: true });

    expect(await screen.findByText("Adres potwierdzony")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Potwierdź adres" })).toBeNull();
  });
});

describe("zmiana hasła", () => {
  async function openChange() {
    await renderApp("/settings", { signedIn: true });
    await press("Zmień hasło");
    await header("Zmień hasło");
  }

  it("obecne i nowe hasło → potwierdzenie, inne urządzenia wylogowane", async () => {
    await openChange();

    await type("Obecne hasło", "stare-haslo");
    await type("Nowe hasło", "nowe-haslo-123");
    await press("Zmień hasło");

    expect(fakeApi.users.changePassword).toHaveBeenCalledWith({
      currentPassword: "stare-haslo",
      newPassword: "nowe-haslo-123",
    });
    expect(
      await screen.findByText(
        "Hasło zmienione. Na innych urządzeniach trzeba zalogować się od nowa.",
      ),
    ).toBeOnTheScreen();
  });

  it("złe obecne hasło", async () => {
    fakeApi.users.changePassword.mockRejectedValueOnce(new ApiError("http", 403, "Invalid"));
    await openChange();

    await type("Obecne hasło", "zle");
    await type("Nowe hasło", "nowe-haslo-123");
    await press("Zmień hasło");

    expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowe hasło.");
  });

  it("walidacja bez wywołania API", async () => {
    await openChange();

    await press("Zmień hasło");

    expect(await screen.findByText("Podaj hasło.")).toBeOnTheScreen();
    expect(screen.getByText("Hasło musi mieć co najmniej 8 znaków.")).toBeOnTheScreen();
    expect(fakeApi.users.changePassword).not.toHaveBeenCalled();
  });
});
