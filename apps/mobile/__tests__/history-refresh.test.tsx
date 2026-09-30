import type { BudgetSummary, SimulationResult } from "@vireo/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fakeApi, testBudget, testSimulation } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { findTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

/**
 * What the API computes right now. A test switches it after the change,
 * so any screen still showing the old numbers has not asked again.
 */
let budget: BudgetSummary;
let simulation: SimulationResult;

beforeEach(() => {
  resetSecureStore();
  budget = testBudget;
  simulation = testSimulation();
  fakeApi.budget.current.mockImplementation(() => Promise.resolve(budget));
  fakeApi.budget.simulate.mockImplementation(() => Promise.resolve(simulation));
});

async function wait(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
/** testTransaction: 45,90 zł on food, 27 September. */
const openExpense = async () => {
  await fireEvent.press(await screen.findByRole("button", { name: /^Jedzenie, 27 września/ }));
  await screen.findByRole("header", { name: "Edytuj wydatek" });
};

/** A simulation on screen, then the dashboard, then the history over it. */
async function openSimulatorThenHistory() {
  await renderApp("/", { signedIn: true });
  await fireEvent.press(await findTab("Symulator"));
  await fireEvent.changeText(await screen.findByLabelText("Kwota"), "120");
  await fireEvent.press(await screen.findByRole("radio", { name: "Jedzenie" }));
  await wait(400);
  expect(await screen.findByText(`Zostanie ${zl("1114 zł")}`)).toBeOnTheScreen();
  await fireEvent.press(await findTab("Start"));
  expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
  await press("Wszystkie wydatki");
  await screen.findByRole("header", { name: "Historia wydatków" });
}

const changes: [string, () => Promise<void>][] = [
  [
    "an edited amount",
    async () => {
      await openExpense();
      await fireEvent.changeText(await screen.findByLabelText("Kwota"), "50");
      await press("Zapisz");
    },
  ],
  [
    "an expense moved to the trash",
    async () => {
      await openExpense();
      await press("Usuń wydatek");
    },
  ],
  [
    "an expense brought back with Cofnij",
    async () => {
      await openExpense();
      await press("Usuń wydatek");
      await screen.findByRole("alert");
      await press("Cofnij");
      await waitFor(() => {
        expect(fakeApi.transactions.restore).toHaveBeenCalled();
      });
    },
  ],
];

it.each(changes)(
  "after %s the dashboard and the simulator show new numbers",
  async (_name, change) => {
    await openSimulatorThenHistory();
    const budgetReads = fakeApi.budget.current.mock.calls.length;
    const simulationsBefore = fakeApi.budget.simulate.mock.calls.length;

    budget = { ...testBudget, availableBalance: 200_000 };
    simulation = testSimulation({ remainingAfter: 188_000 });
    await change();
    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetReads);
    });

    await press("Wstecz");
    expect(await screen.findByText(zl("2000 zł"))).toBeOnTheScreen();
    await fireEvent.press(await findTab("Symulator"));
    expect(await screen.findByText(`Zostanie ${zl("1880 zł")}`)).toBeOnTheScreen();
    expect(fakeApi.budget.simulate.mock.calls.length).toBeGreaterThan(simulationsBefore);
  },
);

it("an edited expense shows on the dashboard's recent expenses", async () => {
  await openSimulatorThenHistory();
  await openExpense();
  await fireEvent.changeText(await screen.findByLabelText("Kwota"), "50");
  await press("Zapisz");
  await screen.findByRole("header", { name: "Historia wydatków" });

  await press("Wstecz");

  expect(
    await screen.findByLabelText(`Jedzenie, 27 września, ${zl("50,00 zł")}`),
  ).toBeOnTheScreen();
});
