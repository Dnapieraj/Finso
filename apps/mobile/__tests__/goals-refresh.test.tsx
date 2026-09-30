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
const zl = (text: string) => text.replaceAll(" ", " ");

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
const type = async (label: string, text: string) => {
  await fireEvent.changeText(await screen.findByLabelText(label), text);
};

/** Dashboard loaded, a 120 zł purchase checked in the simulator, then the goals tab. */
async function openDashboardSimulatorAndGoals() {
  await renderApp("/", { signedIn: true });
  expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
  await fireEvent.press(await findTab("Symulator"));
  await fireEvent.changeText(await screen.findByLabelText("Kwota"), "120");
  await fireEvent.press(await screen.findByRole("radio", { name: "Jedzenie" }));
  await wait(400);
  expect(await screen.findByText(`Zostanie ${zl("1114 zł")}`)).toBeOnTheScreen();
  await fireEvent.press(await findTab("Cele"));
}

const changes: [string, () => Promise<void>][] = [
  [
    "a new goal",
    async () => {
      await press("Dodaj cel");
      await type("Nazwa", "Rower");
      await type("Kwota docelowa", "3000");
      await fireEvent.press(await screen.findByRole("radio", { name: "Czerwiec" }));
      await press("Następny rok");
      await press("Zapisz");
    },
  ],
  [
    "a changed target",
    async () => {
      await press("Wakacje");
      await type("Kwota docelowa", "4500");
      await press("Zapisz");
    },
  ],
  [
    "a goal moved to the trash",
    async () => {
      await press("Wakacje");
      await press("Usuń cel");
    },
  ],
  [
    "a goal brought back with Cofnij",
    async () => {
      await press("Wakacje");
      await press("Usuń cel");
      await screen.findByRole("alert");
      budget = { ...testBudget, availableBalance: 100_000 };
      await press("Cofnij");
      await waitFor(() => {
        expect(fakeApi.goals.restore).toHaveBeenCalled();
      });
    },
  ],
];

it.each(changes)(
  "after %s the dashboard and the simulator show new numbers",
  async (_name, change) => {
    await openDashboardSimulatorAndGoals();
    const budgetReads = fakeApi.budget.current.mock.calls.length;
    const simulationsBefore = fakeApi.budget.simulate.mock.calls.length;

    budget = { ...testBudget, availableBalance: 200_000 };
    simulation = testSimulation({ remainingAfter: 188_000 });
    await change();
    // The undo case set its own number before restoring; the last change wins.
    const expected = budget.availableBalance === 100_000 ? "1000 zł" : "2000 zł";
    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetReads);
    });

    await fireEvent.press(await findTab("Start"));
    expect(await screen.findByText(zl(expected))).toBeOnTheScreen();
    await fireEvent.press(await findTab("Symulator"));
    expect(await screen.findByText(`Zostanie ${zl("1880 zł")}`)).toBeOnTheScreen();
    expect(fakeApi.budget.simulate.mock.calls.length).toBeGreaterThan(simulationsBefore);
  },
);
