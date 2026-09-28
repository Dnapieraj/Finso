import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, pending } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

async function fillIn(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("E-mail"), email);
  await fireEvent.changeText(screen.getByLabelText("Hasło"), password);
}

async function openLogin() {
  const app = await renderApp("/login", { signedIn: false });
  await screen.findByRole("header", { name: "Zaloguj się" });
  return app;
}

it("logs in with the normalised email and opens the app", async () => {
  const app = await openLogin();

  await fillIn("  Ola@Example.com ", "tajne-haslo-123");
  await fireEvent.press(screen.getByRole("button", { name: "Zaloguj się" }));

  await waitFor(() => {
    expect(app).toHavePathname("/");
  });
  expect(fakeApi.auth.login).toHaveBeenCalledWith({
    email: "ola@example.com",
    password: "tajne-haslo-123",
  });
});

it("shows Polish field errors and does not call the API for invalid input", async () => {
  await openLogin();

  await fillIn("ola@", "");
  await fireEvent.press(screen.getByRole("button", { name: "Zaloguj się" }));

  expect(await screen.findByText("Podaj poprawny adres e-mail.")).toBeOnTheScreen();
  expect(screen.getByText("Podaj hasło.")).toBeOnTheScreen();
  expect(fakeApi.auth.login).not.toHaveBeenCalled();
});

it("announces wrong credentials and stays on the login screen", async () => {
  fakeApi.auth.login.mockRejectedValueOnce(new ApiError("http", 401, "Invalid email or password"));
  const app = await openLogin();

  await fillIn("ola@example.com", "zle-haslo");
  await fireEvent.press(screen.getByRole("button", { name: "Zaloguj się" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowy e-mail lub hasło.");
  expect(app).toHavePathname("/login");
});

it("blocks a second tap while the login request is in flight", async () => {
  fakeApi.auth.login.mockReturnValueOnce(pending());
  await openLogin();
  await fillIn("ola@example.com", "tajne-haslo-123");

  await fireEvent.press(screen.getByRole("button", { name: "Zaloguj się" }));
  const button = await screen.findByRole("button", { name: "Logowanie…" });
  expect(button).toBeDisabled();
  await fireEvent.press(button);

  expect(fakeApi.auth.login).toHaveBeenCalledTimes(1);
});

it("hides the password by default and reveals it on demand", async () => {
  await openLogin();

  expect(screen.getByLabelText("Hasło")).toHaveProp("secureTextEntry", true);
  await fireEvent.press(screen.getByRole("button", { name: "Pokaż hasło" }));
  expect(screen.getByLabelText("Hasło")).toHaveProp("secureTextEntry", false);
  expect(screen.getByRole("button", { name: "Ukryj hasło" })).toBeOnTheScreen();
});

it("links to the register screen", async () => {
  const app = await openLogin();

  await fireEvent.press(screen.getByRole("link", { name: "Nie masz konta? Załóż je" }));

  await waitFor(() => {
    expect(app).toHavePathname("/register");
  });
});
