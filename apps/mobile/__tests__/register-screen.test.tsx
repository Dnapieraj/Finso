import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({ api: jest.requireActual("./helpers/fake-api").fakeApi }));

beforeEach(resetSecureStore);

async function openRegister() {
  await renderApp("/register", { signedIn: false });
  await screen.findByRole("header", { name: "Załóż konto" });
}

async function submit(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText("E-mail"), email);
  await fireEvent.changeText(screen.getByLabelText("Hasło"), password);
  await fireEvent.press(screen.getByRole("button", { name: "Załóż konto" }));
}

it("creates the account and opens the app", async () => {
  await openRegister();

  await submit("ola@example.com", "tajne-haslo-123");

  await waitFor(() => expect(screen).toHavePathname("/"));
  expect(fakeApi.auth.register).toHaveBeenCalledWith({
    email: "ola@example.com",
    password: "tajne-haslo-123",
  });
});

it("tells the user the minimum password length up front and enforces it", async () => {
  await openRegister();
  expect(screen.getByText("Co najmniej 8 znaków.")).toBeOnTheScreen();

  await submit("ola@example.com", "1234567");

  expect(await screen.findByText("Hasło musi mieć co najmniej 8 znaków.")).toBeOnTheScreen();
  expect(fakeApi.auth.register).not.toHaveBeenCalled();
});

it("explains that the email is taken and stays on the screen", async () => {
  fakeApi.auth.register.mockRejectedValueOnce(
    new ApiError("http", 409, "Email already registered"),
  );
  await openRegister();

  await submit("ola@example.com", "tajne-haslo-123");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Konto z tym adresem e-mail już istnieje.",
  );
  expect(screen).toHavePathname("/register");
});

it("announces a network failure", async () => {
  fakeApi.auth.register.mockRejectedValueOnce(new ApiError("network", null, "Network request failed"));
  await openRegister();

  await submit("ola@example.com", "tajne-haslo-123");

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
  );
});

it("links back to the login screen", async () => {
  await openRegister();

  await fireEvent.press(screen.getByRole("link", { name: "Masz już konto? Zaloguj się" }));

  await waitFor(() => expect(screen).toHavePathname("/login"));
});
