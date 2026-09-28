import { ApiError } from "@vireo/shared/api";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, pending, testCategory, testGoal, testSimulation } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", " ");

/** How long the simulator waits after the last change before asking the API. */
const DEBOUNCE_MS = 400;

async function wait(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function openSimulator() {
  const app = await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Symulator"));
  await screen.findByRole("header", { name: "Czy mnie stać?" });
  return app;
}

async function plan(amount: string, category = "Jedzenie") {
  await fireEvent.changeText(screen.getByLabelText("Kwota"), amount);
  await fireEvent.press(await screen.findByRole("radio", { name: category }));
  await wait(DEBOUNCE_MS);
}

describe("input", () => {
  it("is a tab of its own at /simulator", async () => {
    const app = await openSimulator();

    expect(app).toHavePathname("/simulator");
  });

  it("explains what to do until both amount and category are set", async () => {
    await openSimulator();

    await fireEvent.changeText(screen.getByLabelText("Kwota"), "120");
    await wait(DEBOUNCE_MS);

    expect(screen.getByText("Wpisz kwotę i wybierz kategorię, żeby sprawdzić.")).toBeOnTheScreen();
    expect(fakeApi.budget.simulate).not.toHaveBeenCalled();
  });

  it("asks the API once, 400 ms after the last change (debounce)", async () => {
    await openSimulator();
    await fireEvent.press(await screen.findByRole("radio", { name: "Jedzenie" }));

    for (const typed of ["1", "12", "120"]) {
      await fireEvent.changeText(screen.getByLabelText("Kwota"), typed);
      await wait(100);
    }
    await wait(DEBOUNCE_MS - 101);
    expect(fakeApi.budget.simulate).not.toHaveBeenCalled();

    await wait(1);
    expect(fakeApi.budget.simulate).toHaveBeenCalledTimes(1);
    expect(fakeApi.budget.simulate).toHaveBeenCalledWith({
      amount: 12_000,
      categoryId: testCategory.id,
    });
  });

  it("marks the chosen category as selected", async () => {
    await openSimulator();

    await plan("120");

    expect(screen.getByRole("radio", { name: "Jedzenie" })).toBeSelected();
  });

  it("an invalid amount shows why and does not ask the API", async () => {
    await openSimulator();

    await plan("12,345");

    expect(screen.getByText("Kwota może mieć najwyżej 2 miejsca po przecinku.")).toBeOnTheScreen();
    expect(fakeApi.budget.simulate).not.toHaveBeenCalled();
  });
});

describe("risk", () => {
  it.each([
    [
      "safe",
      testSimulation(),
      "Stać cię",
      [`Zostanie ${zl("1114 zł")}`, `${zl("92 zł")} dziennie zamiast ${zl("102 zł")}`],
    ],
    [
      "tight",
      testSimulation({ riskLevel: "tight", remainingAfter: 3_456, dailyAllowanceAfter: 288 }),
      "Stać cię, ale będzie ciasno",
      [`Zostanie ${zl("34 zł")}`, `${zl("2 zł")} dziennie zamiast ${zl("102 zł")}`],
    ],
    [
      "over",
      testSimulation({
        canAfford: false,
        riskLevel: "over",
        remainingAfter: -12_001,
        dailyAllowanceAfter: -1_001,
      }),
      "Nie stać cię teraz",
      // A shortfall rounds up: showing less than is missing would mislead.
      [`Zabraknie ${zl("121 zł")}`],
    ],
  ] as const)(
    "%s: says it in words, not only in colour",
    async (_level, result, verdict, details) => {
      fakeApi.budget.simulate.mockResolvedValueOnce(result);
      await openSimulator();

      await plan("120");

      expect(await screen.findByRole("header", { name: verdict })).toBeOnTheScreen();
      for (const line of details) expect(screen.getByText(line)).toBeOnTheScreen();
    },
  );

  it("announces the verdict to screen readers when it changes", async () => {
    await openSimulator();

    await plan("120");

    const verdict = await screen.findByRole("header", { name: "Stać cię" });
    expect(verdict.parent).toHaveProp("accessibilityLiveRegion", "polite");
  });

  it("shows that it is calculating while the API answers", async () => {
    fakeApi.budget.simulate.mockReturnValueOnce(pending());
    await openSimulator();

    await plan("120");

    expect(screen.getByLabelText("Liczę…")).toBeOnTheScreen();
  });

  it("offers a retry when the simulation fails", async () => {
    fakeApi.budget.simulate.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openSimulator();

    await plan("120");

    expect(await screen.findByText("Nie udało się policzyć.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByRole("header", { name: "Stać cię" })).toBeOnTheScreen();
  });
});

describe("goals", () => {
  const laptop = testGoal({ id: "01923b6e-0000-7000-8000-000000000011", name: "Laptop" });

  // The engine computes each goal's delay on its own, as if that goal alone
  // took the whole shortfall; the numbers must not be added up or split.
  it("shows each goal's own delay as the engine computed it, with no total", async () => {
    // Fetched by the dashboard and again when the simulator tab mounts.
    fakeApi.goals.list
      .mockResolvedValueOnce([testGoal(), laptop])
      .mockResolvedValueOnce([testGoal(), laptop]);
    fakeApi.budget.simulate.mockResolvedValueOnce(
      testSimulation({
        riskLevel: "over",
        canAfford: false,
        remainingAfter: -130_000,
        goalImpacts: [
          { goalId: testGoal().id, delayDays: 31 },
          { goalId: laptop.id, delayDays: 29 },
        ],
      }),
    );
    await openSimulator();

    await plan("1300");

    expect(await screen.findByText("Wakacje: później o 31 dni")).toBeOnTheScreen();
    expect(screen.getByText("Laptop: później o 29 dni")).toBeOnTheScreen();
    expect(
      screen.getByText("Każdy cel liczony osobno — opóźnienia się nie sumują."),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/60 dni/)).not.toBeOnTheScreen();
  });

  it("lists only goals the purchase delays; says '1 dzień'", async () => {
    fakeApi.goals.list
      .mockResolvedValueOnce([testGoal(), laptop])
      .mockResolvedValueOnce([testGoal(), laptop]);
    fakeApi.budget.simulate.mockResolvedValueOnce(
      testSimulation({
        goalImpacts: [
          { goalId: testGoal().id, delayDays: 1 },
          { goalId: laptop.id, delayDays: 0 },
        ],
      }),
    );
    await openSimulator();

    await plan("120");

    expect(await screen.findByText("Wakacje: później o 1 dzień")).toBeOnTheScreen();
    expect(screen.queryByText(/Laptop/)).not.toBeOnTheScreen();
    // One affected goal: nothing to add up, so no note about sums.
    expect(screen.queryByText(/nie sumują/)).not.toBeOnTheScreen();
  });

  it("says so when no goal is affected", async () => {
    await openSimulator();

    await plan("120");

    expect(await screen.findByText("Nie wpływa na Twoje cele.")).toBeOnTheScreen();
  });
});

describe("Zapisz jako wydatek", () => {
  it("is available only once there is a result", async () => {
    await openSimulator();

    expect(screen.queryByRole("button", { name: "Zapisz jako wydatek" })).not.toBeOnTheScreen();
    await plan("120");

    expect(await screen.findByRole("button", { name: "Zapisz jako wydatek" })).toBeOnTheScreen();
  });

  it("saves the planned purchase like the quick add and returns to Start", async () => {
    const app = await openSimulator();
    await plan("120");

    await fireEvent.press(await screen.findByRole("button", { name: "Zapisz jako wydatek" }));

    await waitFor(() => {
      expect(app).toHavePathname("/");
    });
    expect(fakeApi.transactions.create).toHaveBeenCalledWith({
      input: { amount: 12_000, date: "2026-09-28", categoryId: testCategory.id },
      idempotencyKey: "idempotency-key-1",
    });
    expect(await screen.findByText(`Zapisano ${zl("120,00 zł")} · Jedzenie`)).toBeOnTheScreen();
  });
});
