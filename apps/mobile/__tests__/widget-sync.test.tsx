import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { devicePreferences } from "../src/preferences/device-preferences";
import { loadWidgetSnapshot } from "../src/widget/snapshot-store";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/**
 * The home screen widget reads what the app saved last — the widget task
 * runs without the API and without the user being there.
 */
describe("widget snapshot", () => {
  it("the loaded budget is saved for the widget: today's amount, its day and zone", async () => {
    await renderApp("/", { signedIn: true });
    await screen.findByText("Możesz wydać");

    await waitFor(async () => {
      expect(await loadWidgetSnapshot()).toEqual({
        asOf: "2026-09-28",
        timeZone: "Europe/Warsaw",
        periodEnd: "2026-10-09",
        available: 123_456,
        todayLeft: 10_288,
        hidden: false,
      });
    });
  });

  it("privacy mode hides the amount on the widget too", async () => {
    await renderApp("/", { signedIn: true });
    await screen.findByText("Możesz wydać");

    await devicePreferences.set({ hideAmounts: true });

    await waitFor(async () => {
      expect(await loadWidgetSnapshot()).toMatchObject({ hidden: true });
    });
    await devicePreferences.set({ hideAmounts: false });
  });

  it("logging out removes it — the widget asks to open the app", async () => {
    await renderApp("/", { signedIn: true });
    await screen.findByText("Możesz wydać");
    await waitFor(async () => {
      expect(await loadWidgetSnapshot()).not.toBeNull();
    });

    await fireEvent.press(await findTab("Ustawienia"));
    await fireEvent.press(await screen.findByRole("button", { name: "Wyloguj się" }));

    await waitFor(async () => {
      expect(await loadWidgetSnapshot()).toBeNull();
    });
  });
});
