import { ExecutionEnvironment } from "expo-constants";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, seedFakeServer, testDue } from "./helpers/fake-api";
import {
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduled,
  setPermission,
} from "./helpers/fake-notifications";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";
import { notificationsSupportedOn } from "../src/notifications/native";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));
// Expo Go on Android: importing expo-notifications throws there.
jest.mock("../src/notifications/native", () => ({
  ...jest.requireActual<object>("../src/notifications/native"),
  loadNotifications: () => Promise.resolve(null),
}));

beforeEach(resetSecureStore);

describe("gdzie działają powiadomienia", () => {
  it.each([
    ["android", ExecutionEnvironment.StoreClient, false],
    ["ios", ExecutionEnvironment.StoreClient, true],
    ["android", ExecutionEnvironment.Bare, true],
    ["android", ExecutionEnvironment.Standalone, true],
  ] as const)("%s, %s → %s", (os, environment, supported) => {
    expect(notificationsSupportedOn(os, environment)).toBe(supported);
  });
});

describe("w Expo Go na Androidzie", () => {
  it("appka działa, a Ustawienia → Powiadomienia mówią, czemu ich nie ma", async () => {
    setPermission("granted");
    await renderApp("/", { signedIn: true });
    await fireEvent.press(await findTab("Ustawienia"));
    await fireEvent.press(await screen.findByRole("button", { name: "Powiadomienia" }));

    expect(
      await screen.findByText("Powiadomienia działają w zainstalowanej aplikacji, nie w Expo Go."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("switch", { name: "Dzień wypłaty" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Dzień wypłaty" })).not.toBeChecked();
    expect(getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("karta nie pyta o przypomnienia i nic nie jest planowane", async () => {
    seedFakeServer({ due: [testDue()] });
    await renderApp("/", { signedIn: true });

    await fireEvent.press(await screen.findByRole("button", { name: "Tak: Czynsz" }));

    await waitFor(() => {
      expect(fakeApi.confirmations.answer).toHaveBeenCalled();
    });
    expect(screen.queryByText("Przypominać w dniu wypłaty i płatności?")).not.toBeOnTheScreen();
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
    expect(scheduled()).toEqual([]);
  });
});
