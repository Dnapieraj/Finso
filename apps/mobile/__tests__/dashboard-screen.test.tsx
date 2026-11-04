import { ApiError } from "@vireo/shared/api";
import { act, fireEvent, screen, within } from "expo-router/testing-library";
import type { ReactElement } from "react";
import type { RefreshControlProps } from "react-native";

import { fakeApi, pending, testBudget, testTransaction, transactionPage } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

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

  it("shows what is left for today, then the daily amount until payday", async () => {
    await openDashboard();

    expect(await screen.findByText(`Dziś możesz wydać ${zl("102 zł")}`)).toBeOnTheScreen();
    expect(
      screen.getByText(`Potem ${zl("102 zł")} dziennie przez 11 dni · do wypłaty 10 października`),
    ).toBeOnTheScreen();
  });

  it("the leftover from yesterday is added to today, said in so many words", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      today: {
        limit: 25_400,
        spent: 0,
        left: 25_400,
        carriedFromYesterday: 2_000,
        nextDays: 9_900,
      },
    });
    await openDashboard();

    expect(
      await screen.findByText(`Wczoraj zostało ${zl("20 zł")}, dziś masz ${zl("254 zł")}`),
    ).toBeOnTheScreen();
    expect(screen.getByText(`Dziś możesz wydać ${zl("254 zł")}`)).toBeOnTheScreen();
  });

  it("nothing left from yesterday: no carry-over line", async () => {
    await openDashboard();
    await screen.findByText(`Dziś możesz wydać ${zl("102 zł")}`);

    expect(screen.queryByText(/Wczoraj zostało/)).not.toBeOnTheScreen();
  });

  it("over the limit today: says by how much, rounded up", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      today: {
        limit: 10_288,
        spent: 15_000,
        left: -4_712,
        carriedFromYesterday: 0,
        nextDays: 9_859,
      },
    });
    await openDashboard();

    expect(
      await screen.findByText(`Dziś wydano o ${zl("48 zł")} więcej, niż planowano`),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Dziś możesz wydać/)).not.toBeOnTheScreen();
    expect(
      screen.getByText(`Potem ${zl("98 zł")} dziennie przez 11 dni · do wypłaty 10 października`),
    ).toBeOnTheScreen();
  });

  it("the last day of the period: no days after it", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      daysRemaining: 1,
      today: { limit: 123_456, spent: 0, left: 123_456, carriedFromYesterday: 0, nextDays: 0 },
    });
    await openDashboard();

    expect(
      await screen.findByText("Ostatni dzień okresu · wypłata 10 października"),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/^Potem/)).not.toBeOnTheScreen();
  });

  it("shows the budget period as a progress bar with its day count", async () => {
    await openDashboard();

    const bar = await screen.findByRole("progressbar", { name: "Okres budżetowy" });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 30, now: 19, text: "Dzień 19 z 30" });
    expect(screen.getByText("Dzień 19 z 30")).toBeOnTheScreen();
  });

  // At "Bardzo duży" × the largest system font the amount would be wider
  // than the phone: it shrinks to fit instead of breaking or overflowing.
  it("the main amount stays on one line and shrinks to fit the width", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({ ...testBudget, availableBalance: 1_234_567_89 });
    await openDashboard();

    const amount = await screen.findByText(zl("1 234 567 zł"));
    expect(amount).toHaveProp("numberOfLines", 1);
    expect(amount).toHaveProp("adjustsFontSizeToFit", true);
  });

  it("the amount under the line fits the same way", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      availableBalance: -1_234_567_89,
      dailyAllowance: -720,
    });
    await openDashboard();

    const amount = await screen.findByText(zl("1 234 568 zł"));
    expect(amount).toHaveProp("numberOfLines", 1);
    expect(amount).toHaveProp("adjustsFontSizeToFit", true);
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
    expect(screen.queryByText(/^Dziś/)).not.toBeOnTheScreen();
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

  it("irregular income: says how much of the budget is still only a forecast", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      incomeForecasts: [
        {
          incomeSourceId: "01923b6e-0000-7000-8000-000000000051",
          name: "Zlecenia",
          forecast: 300_000,
          periods: 4,
          low: 300_000,
          high: 750_000,
          received: 100_000,
          notYetReceived: 200_000,
        },
      ],
    });
    await openDashboard();

    // Rounded up: better to overstate what has not come in yet.
    expect(
      await screen.findByText(`W tym ${zl("2000 zł")} z prognozy dochodu — jeszcze nie wpłynęło.`),
    ).toBeOnTheScreen();
  });

  it("forecast already reached: no forecast line", async () => {
    fakeApi.budget.current.mockResolvedValueOnce({
      ...testBudget,
      incomeForecasts: [
        {
          ...{
            incomeSourceId: "01923b6e-0000-7000-8000-000000000051",
            name: "Zlecenia",
            forecast: 300_000,
            periods: 4,
            low: 300_000,
            high: 750_000,
            received: 100_000,
            notYetReceived: 200_000,
          },
          received: 400_000,
          notYetReceived: 0,
        },
      ],
    });
    await openDashboard();
    await screen.findByText("Możesz wydać");

    expect(screen.queryByText(/z prognozy dochodu/)).toBeNull();
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

it("no goals card: goals have their own tab, the dashboard answers „can I afford it”", async () => {
  await openDashboard();
  await screen.findByText("Jedzenie");

  expect(screen.queryByRole("progressbar", { name: "Wakacje" })).toBeNull();
  expect(fakeApi.goals.list).not.toHaveBeenCalled();
});

describe("recent expenses", () => {
  it("asks only for the 5 latest confirmed expenses", async () => {
    await openDashboard();
    await screen.findByText("Jedzenie");

    expect(fakeApi.transactions.list).toHaveBeenCalledWith({ status: "CONFIRMED", limit: 5 });
  });

  it("two lines: the category, then the date; the exact amount on the right", async () => {
    await openDashboard();

    const row = await screen.findByLabelText(`Jedzenie, 27 września, ${zl("45,90 zł")}`);
    expect(within(row).getByText("Jedzenie")).toBeOnTheScreen();
    expect(within(row).getByText("27 września")).toBeOnTheScreen();
    expect(within(row).getByText(zl("45,90 zł"))).toBeOnTheScreen();
  });

  it("with a note: the note is the title, the category goes next to the date", async () => {
    fakeApi.transactions.list.mockResolvedValueOnce(
      transactionPage([testTransaction({ categoryId: null, note: "Prezent dla mamy" })]),
    );
    await openDashboard();

    const row = await screen.findByLabelText(
      `Bez kategorii, 27 września, ${zl("45,90 zł")}, Prezent dla mamy`,
    );
    expect(within(row).getByText("Prezent dla mamy")).toBeOnTheScreen();
    expect(within(row).getByText("Bez kategorii · 27 września")).toBeOnTheScreen();
  });

  it("tapping an expense opens it, like in the history", async () => {
    const app = await renderApp("/", { signedIn: true });

    await fireEvent.press(
      await screen.findByRole("button", { name: `Jedzenie, 27 września, ${zl("45,90 zł")}` }),
    );

    await screen.findByRole("header", { name: "Edytuj wydatek" });
    expect(app).toHavePathname(`/expense/${testTransaction().id}`);
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

it("pull to refresh reloads the budget and expenses", async () => {
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
  expect(fakeApi.transactions.list).toHaveBeenCalledTimes(1);
});
