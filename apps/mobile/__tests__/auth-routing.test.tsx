import { act, screen, waitFor } from "expo-router/testing-library";

import { queryClient } from "../src/query-client";
import { session } from "../src/session";
// The same module instance jest.setup.js installs as expo-secure-store.
import { getItemAsync, resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab, getTab, queryTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

it("sends a signed-out user from any screen to the login screen", async () => {
  const app = await renderApp("/settings", { signedIn: false });

  await waitFor(() => {
    expect(app).toHavePathname("/login");
  });
  expect(screen.getByRole("header", { name: "Zaloguj się" })).toBeOnTheScreen();
});

it("opens the app for a user with a saved session, with Start and Ustawienia tabs", async () => {
  const app = await renderApp("/", { signedIn: true });

  await waitFor(() => {
    expect(app).toHavePathname("/");
  });
  // The account loads first: it decides between onboarding and the tabs.
  expect(await findTab("Start")).toBeOnTheScreen();
  expect(getTab("Ustawienia")).toBeOnTheScreen();
});

it("sends a signed-in user away from the login and register screens", async () => {
  const app = await renderApp("/register", { signedIn: true });

  await waitFor(() => {
    expect(app).toHavePathname("/");
  });
});

it("shows nothing until the session is restored, so login never flashes for a signed-in user", async () => {
  let finishRead: (value: string | null) => void = () => undefined;
  getItemAsync.mockReturnValueOnce(new Promise((resolve) => (finishRead = resolve)));

  await renderApp("/", { signedIn: true });

  expect(screen.queryByRole("header", { name: "Zaloguj się" })).not.toBeOnTheScreen();
  expect(queryTab("Start")).not.toBeOnTheScreen();

  await act(async () => {
    finishRead("refresh");
    // restore() hands back the read already in flight, so this waits for it.
    await session.restore();
  });
  await waitFor(() => {
    expect(getTab("Start")).toBeOnTheScreen();
  });
});

it("moves the user to login with a notice when the session expires mid-use", async () => {
  const app = await renderApp("/settings", { signedIn: true });
  await waitFor(() => {
    expect(app).toHavePathname("/settings");
  });

  // What src/api.ts does when the refresh token is rejected.
  await act(() => session.signedOut("expired"));

  await waitFor(() => {
    expect(app).toHavePathname("/login");
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Sesja wygasła. Zaloguj się ponownie.");
  // Data cached for the previous user must not survive in memory.
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
