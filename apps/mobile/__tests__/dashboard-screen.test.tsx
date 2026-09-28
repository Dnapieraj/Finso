import { ApiError } from "@vireo/shared/api";
import { act, fireEvent, screen, within } from "expo-router/testing-library";
import type { ReactElement } from "react";
import type { RefreshControlProps } from "react-native";

import {
  fakeApi,
  pending,
  testBudget,
  testGoal,
  testTransaction,
  transactionPage,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

/**
 * Network errors and 5xx are retried twice (src/query-client.ts), so a
 * section only shows its error once all three attempts have failed.
 */
function failAllAttempts(mock: jest.Mock, error: Error) {
  mock.mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error);
}
/** Retries wait 1 s, then 2 s. */
const AFTER_RETRIES = { timeout: 5000 };

async function openDashboard() {
  await renderApp("/", { signedIn: true });
  await screen.findByRole("header", { name: "Twój budżet" });
}

describe("budget", () => {
  it("shows how much can be spent, rounded down to whole złoty", async () => {
    await openDashboard();

    expect(await screen.findByText("Możesz wydać")).toBeOnTheScreen();
    expect(screen.getByText(zl("1234 zł"))).toBeOnTheScreen();
  });

  it("shows the daily amount until payday", async () => {
    await openDashboard();

    expect(await screen.findByText(`${zl("102 zł")} dziennie`)).toBeOnTheScreen();
    expect(screen.getByText("przez 12 dni · do wypłaty 10 października")).toBeOnTheScreen();
  });

  it("says '1 dzień' on the last day of the period", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({ ...testBudget, daysRemaining: 1 });
    await openDashboard();

    expect(await screen.findByText("przez 1 dzień · do wypłaty 10 października")).toBeOnTheScreen();
  });

  it("shows the budget period as a progress bar with its day count", async () => {
    await openDashboard();

    const bar = await screen.findByRole("progressbar", { name: "Okres budżetowy" });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 30, now: 19, text: "Dzień 19 z 30" });
    expect(screen.getByText("Dzień 19 z 30")).toBeOnTheScreen();
  });

  it("below zero: says how far under the line, rounded up, and hides the daily amount", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      availableBalance: -8_640,
      dailyAllowance: -720,
    });
    await openDashboard();

    expect(await screen.findByText("Jesteś pod kreską o")).toBeOnTheScreen();
    expect(screen.getByText(zl("87 zł"))).toBeOnTheScreen();
    expect(screen.getByText("Do wypłaty nie masz wolnych środków.")).toBeOnTheScreen();
    expect(screen.queryByText(/dziennie/)).not.toBeOnTheScreen();
  });

  it("with no income in the period, explains why there is nothing to spend", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      availableBalance: 0,
      dailyAllowance: 0,
      breakdown: { ...testBudget.breakdown, periodIncome: 0 },
    });
    await openDashboard();

    expect(await screen.findByText("Nie masz jeszcze dochodu w tym okresie.")).toBeOnTheScreen();
  });

  it("shows a skeleton while the budget loads", async () => {
    fakeApi.budget.current.mockReturnValueOnce(pending());
    await openDashboard();

    expect(screen.getByLabelText("Wczytywanie budżetu")).toBeOnTheScreen();
  });

  it("shows an error with a retry when the budget cannot be loaded", async () => {
    fakeApi.budget.current.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openDashboard();

    expect(await screen.findByText("Nie udało się wczytać budżetu.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
  });
});

describe("goals", () => {
  it("shows each goal with a progress bar and the saved amount", async () => {
    await openDashboard();

    const bar = await screen.findByRole("progressbar", { name: "Wakacje" });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 25, text: "25%" });
    expect(screen.getByText(zl("1000 zł z 4000 zł"))).toBeOnTheScreen();
  });

  it("shows only the 3 nearest goals and counts the rest", async () => {
    // The API lists goals by target date, nearest first.
    fakeApi.goals.list.mockResolvedValueOnce(
      ["Wakacje", "Laptop", "Rower", "Kurs", "Auto"].map((name, i) =>
        testGoal({ id: `01923b6e-0000-7000-8000-00000000001${String(i)}`, name }),
      ),
    );
    await openDashboard();

    expect(await screen.findByRole("progressbar", { name: "Rower" })).toBeOnTheScreen();
    expect(screen.queryByRole("progressbar", { name: "Kurs" })).not.toBeOnTheScreen();
    expect(screen.getByText("+2 kolejne cele")).toBeOnTheScreen();
  });

  it("marks a reached goal and an overdue one", async () => {
    fakeApi.goals.list.mockResolvedValueOnce([
      testGoal({ name: "Laptop", currentAmount: 400_000 }),
      testGoal({
        id: "01923b6e-0000-7000-8000-000000000011",
        name: "Rower",
        targetDate: "2026-09-01",
      }),
    ]);
    await openDashboard();

    expect(await screen.findByText("Cel osiągnięty")).toBeOnTheScreen();
    expect(screen.getByText("Po terminie")).toBeOnTheScreen();
  });

  it("has an empty state", async () => {
    fakeApi.goals.list.mockResolvedValueOnce([]);
    await openDashboard();

    expect(await screen.findByText("Nie masz jeszcze celów.")).toBeOnTheScreen();
  });

  it("fails on its own: the budget stays visible", async () => {
    failAllAttempts(fakeApi.goals.list, new ApiError("http", 500, "HTTP 500"));
    await openDashboard();

    expect(
      await screen.findByText("Nie udało się wczytać celów.", {}, AFTER_RETRIES),
    ).toBeOnTheScreen();
    expect(screen.getByText(zl("1234 zł"))).toBeOnTheScreen();
  });
});

describe("recent expenses", () => {
  it("asks only for the 5 latest confirmed expenses", async () => {
    await openDashboard();
    await screen.findByText("Jedzenie");

    expect(fakeApi.transactions.list).toHaveBeenCalledWith({ status: "CONFIRMED", limit: 5 });
  });

  it("shows category, date and the exact amount", async () => {
    await openDashboard();

    const row = await screen.findByLabelText(`Jedzenie, 27 września, ${zl("45,90 zł")}`);
    expect(within(row).getByText("Jedzenie")).toBeOnTheScreen();
    expect(within(row).getByText("27 września")).toBeOnTheScreen();
    expect(within(row).getByText(zl("45,90 zł"))).toBeOnTheScreen();
  });

  it("shows the note when there is one, and 'Bez kategorii' without a category", async () => {
    fakeApi.transactions.list.mockResolvedValueOnce(
      transactionPage([testTransaction({ categoryId: null, note: "Prezent dla mamy" })]),
    );
    await openDashboard();

    expect(await screen.findByText("Bez kategorii")).toBeOnTheScreen();
    expect(screen.getByText("Prezent dla mamy")).toBeOnTheScreen();
  });

  it("has an empty state", async () => {
    fakeApi.transactions.list.mockResolvedValueOnce(transactionPage([]));
    await openDashboard();

    expect(await screen.findByText("Nie masz jeszcze wydatków.")).toBeOnTheScreen();
  });

  it("fails on its own with a retry", async () => {
    failAllAttempts(fakeApi.transactions.list, new ApiError("network", null, "offline"));
    await openDashboard();

    expect(
      await screen.findByText("Nie udało się wczytać wydatków.", {}, AFTER_RETRIES),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByText("Jedzenie")).toBeOnTheScreen();
  });
});

it("pull to refresh reloads the budget, goals and expenses", async () => {
  await openDashboard();
  await screen.findByText("Jedzenie");
  jest.clearAllMocks();

  // RN's ScrollView mock does not render its RefreshControl, so the pull
  // is simulated through the prop, as the RNTL docs suggest.
  const scroll = screen.getByTestId("dashboard-scroll");
  const { refreshControl } = scroll.props as { refreshControl: ReactElement<RefreshControlProps> };
  await act(async () => {
    refreshControl.props.onRefresh?.();
    // onRefresh returns void; the refetches settle on the following
    // microtasks, which this async act scope waits out.
    await Promise.resolve();
  });

  expect(fakeApi.budget.current).toHaveBeenCalledTimes(1);
  expect(fakeApi.goals.list).toHaveBeenCalledTimes(1);
  expect(fakeApi.transactions.list).toHaveBeenCalledTimes(1);
});
