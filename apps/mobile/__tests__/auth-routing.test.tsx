import { act, screen, waitFor } from "expo-router/testing-library";

import { queryClient } from "../src/query-client";
import { session } from "../src/session";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({ api: jest.requireActual("./helpers/fake-api").fakeApi }));

beforeEach(resetSecureStore);

it("sends a signed-out user from any screen to the login screen", async () => {
  await renderApp("/settings", { signedIn: false });

  await waitFor(() => expect(screen).toHavePathname("/login"));
  expect(screen.getByRole("header", { name: "Zaloguj się" })).toBeOnTheScreen();
});

it("opens the app for a user with a saved session, with Start and Ustawienia tabs", async () => {
  await renderApp("/", { signedIn: true });

  await waitFor(() => expect(screen).toHavePathname("/"));
  expect(screen.getByRole("tab", { name: "Start" })).toBeOnTheScreen();
  expect(screen.getByRole("tab", { name: "Ustawienia" })).toBeOnTheScreen();
});

it("sends a signed-in user away from the login and register screens", async () => {
  await renderApp("/register", { signedIn: true });

  await waitFor(() => expect(screen).toHavePathname("/"));
});

it("shows nothing until the session is restored, so login never flashes for a signed-in user", async () => {
  let finishRead: (value: string | null) => void = () => undefined;
  const { getItemAsync } = jest.requireMock<typeof import("./helpers/memory-secure-store")>(
    "expo-secure-store",
  );
  getItemAsync.mockReturnValueOnce(new Promise((resolve) => (finishRead = resolve)));

  await renderApp("/", { signedIn: true });

  expect(screen.queryByRole("header", { name: "Zaloguj się" })).not.toBeOnTheScreen();
  expect(screen.queryByRole("tab", { name: "Start" })).not.toBeOnTheScreen();

  await act(async () => finishRead("refresh"));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Start" })).toBeOnTheScreen());
});

it("moves the user to login with a notice when the session expires mid-use", async () => {
  await renderApp("/settings", { signedIn: true });
  await waitFor(() => expect(screen).toHavePathname("/settings"));

  // What src/api.ts does when the refresh token is rejected.
  await act(() => session.signedOut("expired"));

  await waitFor(() => expect(screen).toHavePathname("/login"));
  expect(screen.getByRole("alert")).toHaveTextContent("Sesja wygasła. Zaloguj się ponownie.");
  // Data cached for the previous user must not survive in memory.
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});
