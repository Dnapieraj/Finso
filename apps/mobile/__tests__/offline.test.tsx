import { screen, waitFor } from "expo-router/testing-library";

import { fakeApi } from "./helpers/fake-api";
import { goOffline, goOnline, setNetwork } from "./helpers/fake-netinfo";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

const OFFLINE = "Brak połączenia";

async function openDashboard() {
  await renderApp("/", { signedIn: true });
  await screen.findByTestId("available-balance");
}

it("z internetem: żadnego paska", async () => {
  await openDashboard();

  expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
});

it("bez internetu: pasek u góry, ogłoszony czytnikowi ekranu; dane zostają na ekranie", async () => {
  await openDashboard();

  await goOffline();

  const bar = await screen.findByRole("alert");
  expect(bar).toHaveTextContent(OFFLINE, { exact: false });
  // What was already loaded stays readable offline.
  expect(screen.getByTestId("available-balance")).toBeOnTheScreen();
});

it("Wi-Fi bez dostępu do internetu też jest brakiem połączenia", async () => {
  await openDashboard();

  await setNetwork({ isConnected: true, isInternetReachable: false });

  expect(await screen.findByText(OFFLINE)).toBeOnTheScreen();
});

// Right after connecting the phone does not know yet; a flash of the bar
// on every Wi-Fi change would be noise.
it("„jeszcze nie wiadomo” (isInternetReachable null) to nie brak połączenia", async () => {
  await openDashboard();

  await setNetwork({ isConnected: true, isInternetReachable: null });

  expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
});

it("po powrocie internetu pasek znika, a appka sama odświeża dane", async () => {
  await openDashboard();
  await goOffline();
  await screen.findByText(OFFLINE);
  const budgetCalls = fakeApi.budget.current.mock.calls.length;
  const expenseCalls = fakeApi.transactions.list.mock.calls.length;

  await goOnline();

  await waitFor(() => {
    expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
  });
  await waitFor(() => {
    expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetCalls);
  });
  expect(fakeApi.transactions.list.mock.calls.length).toBeGreaterThan(expenseCalls);
});

it("start bez internetu: pasek zamiast błędu; po powrocie dane wczytują się same", async () => {
  await goOffline();
  await renderApp("/", { signedIn: true });

  expect(await screen.findByText(OFFLINE)).toBeOnTheScreen();
  // Waiting for the network, not failing: no "Spróbuj ponownie" to tap.
  expect(screen.queryByText("Nie udało się wczytać budżetu.")).not.toBeOnTheScreen();

  await goOnline();

  expect(await screen.findByTestId("available-balance")).toBeOnTheScreen();
  expect(screen.queryByText(OFFLINE)).not.toBeOnTheScreen();
});

it("na ekranie logowania też", async () => {
  await renderApp("/login", { signedIn: false });
  await screen.findByRole("header", { name: "Zaloguj się" });

  await goOffline();

  expect(await screen.findByText(OFFLINE)).toBeOnTheScreen();
});
