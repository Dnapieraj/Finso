import type { BudgetSummary, SimulationResult } from "@vireo/shared";
import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  billsCategory,
  fakeApi,
  testBudget,
  testCategory,
  testSimulation,
} from "./helpers/fake-api";
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
  fakeApi.categories.list.mockResolvedValue([testCategory, billsCategory]);
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

/** Dashboard loaded, and a 120 zł purchase checked in the simulator. */
async function openDashboardAndSimulator() {
  await renderApp("/", { signedIn: true });
  expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
  await fireEvent.press(await findTab("Symulator"));
  await fireEvent.changeText(await screen.findByLabelText("Kwota"), "120");
  await fireEvent.press(await screen.findByRole("radio", { name: "Jedzenie" }));
  await wait(400);
  expect(await screen.findByText(`Zostanie ${zl("1114 zł")}`)).toBeOnTheScreen();
  await fireEvent.press(await findTab("Ustawienia"));
}

/** Each change a user can make in the budget settings, done from the settings tab. */
const changes: [string, () => Promise<void>][] = [
  [
    "a new payday",
    async () => {
      await press("Dzień wypłaty");
      await fireEvent.press(await screen.findByRole("radio", { name: "25" }));
      await press("Zapisz");
    },
  ],
  [
    "an income's amount",
    async () => {
      await press("Dochody");
      await press("Wypłata");
      await type("Kwota", "5200");
      await press("Zapisz");
    },
  ],
  [
    "a new commitment",
    async () => {
      await press("Stałe zobowiązania");
      await press("Dodaj zobowiązanie");
      await type("Nazwa", "Siłownia");
      await type("Kwota", "120");
      await type("Dzień miesiąca", "15");
      await fireEvent.press(await screen.findByRole("radio", { name: "Rachunki" }));
      await press("Zapisz");
    },
  ],
  [
    "a deleted commitment",
    async () => {
      await press("Stałe zobowiązania");
      await press("Czynsz");
      await press("Usuń zobowiązanie");
      await press("Usuń");
    },
  ],
];

it.each(changes)(
  "after %s the dashboard and the simulator show new numbers",
  async (_name, change) => {
    await openDashboardAndSimulator();
    const simulationsBefore = fakeApi.budget.simulate.mock.calls.length;

    budget = { ...testBudget, availableBalance: 200_000 };
    simulation = testSimulation({ remainingAfter: 188_000 });
    await change();
    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(1);
    });

    await fireEvent.press(await findTab("Start"));
    expect(await screen.findByText(zl("2000 zł"))).toBeOnTheScreen();
    await fireEvent.press(await findTab("Symulator"));
    expect(await screen.findByText(`Zostanie ${zl("1880 zł")}`)).toBeOnTheScreen();
    expect(fakeApi.budget.simulate.mock.calls.length).toBeGreaterThan(simulationsBefore);
  },
);
