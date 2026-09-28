import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, pending, testUser } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({ api: jest.requireActual("./helpers/fake-api").fakeApi }));

beforeEach(resetSecureStore);

async function openSettingsTab() {
  const app = await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Ustawienia"));
  await screen.findByRole("header", { name: "Ustawienia" });
  return app;
}

it("shows the email of the signed-in account", async () => {
  await openSettingsTab();

  expect(await screen.findByText(testUser.email)).toBeOnTheScreen();
});

it("shows a skeleton while the account is loading", async () => {
  fakeApi.users.me.mockReturnValueOnce(pending());

  await openSettingsTab();

  expect(screen.getByLabelText("Wczytywanie danych konta")).toBeOnTheScreen();
});

it("shows an error with a retry when the account cannot be loaded", async () => {
  fakeApi.users.me.mockRejectedValueOnce(
    new ApiError("invalid-response", 200, "Response does not match the schema"),
  );
  await openSettingsTab();

  expect(await screen.findByText("Nie udało się wczytać danych konta.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Spróbuj ponownie" }));

  expect(await screen.findByText(testUser.email)).toBeOnTheScreen();
});

it("logs out and returns to the login screen without a notice", async () => {
  const app = await openSettingsTab();

  await fireEvent.press(screen.getByRole("button", { name: "Wyloguj się" }));

  await waitFor(() => expect(app).toHavePathname("/login"));
  expect(fakeApi.auth.logout).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
});
