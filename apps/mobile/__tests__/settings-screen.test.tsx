import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, testUser } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

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

it("logs out and returns to the login screen without a notice", async () => {
  const app = await openSettingsTab();

  await fireEvent.press(screen.getByRole("button", { name: "Wyloguj się" }));

  await waitFor(() => {
    expect(app).toHavePathname("/login");
  });
  expect(fakeApi.auth.logout).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
});

describe("budget settings", () => {
  it("shows the payday and opens its screen", async () => {
    const app = await openSettingsTab();

    expect(screen.getByText("10. dnia miesiąca")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Dzień wypłaty" }));

    await screen.findByRole("header", { name: "Dzień wypłaty" });
    expect(app).toHavePathname("/settings/payday");
  });

  it.each([
    ["Dochody", "/settings/income"],
    ["Stałe zobowiązania", "/settings/commitments"],
  ])("opens %s", async (name, path) => {
    const app = await openSettingsTab();

    await fireEvent.press(screen.getByRole("button", { name }));

    await screen.findByRole("header", { name });
    expect(app).toHavePathname(path);
  });
});
