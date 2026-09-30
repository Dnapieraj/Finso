import type { Transaction } from "@vireo/shared";
import { ApiError } from "@vireo/shared/api";
import { fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  fakeApi,
  pending,
  seedFakeServer,
  testCategory,
  testTransaction,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const transport = {
  ...testCategory,
  id: "01923b6e-0000-7000-8000-000000000023",
  name: "Transport",
  icon: "car",
  color: "#3B82F6",
};

let nextId = 0;
function expense(overrides: Partial<Transaction>): Transaction {
  nextId += 1;
  return testTransaction({
    id: `01923b6e-0000-7000-8000-0000000007${String(nextId).padStart(2, "0")}`,
    note: null,
    ...overrides,
  });
}

/**
 * The budget period of testBudget is 10.09–9.10 (payday on the 10th).
 * September: food 450 zł, transport 300 zł, 50 zł without a category.
 */
const lunch = expense({ amount: 4_500, date: "2026-09-27", note: "Obiad" });
const groceries = expense({ amount: 40_500, date: "2026-09-12" });
const bus = expense({ amount: 30_000, date: "2026-09-20", categoryId: transport.id });
const misc = expense({ amount: 5_000, date: "2026-09-15", categoryId: null });
const august = expense({ amount: 12_000, date: "2026-08-20" });

beforeEach(() => {
  resetSecureStore();
  fakeApi.categories.list.mockResolvedValue([testCategory, transport]);
  seedFakeServer({ transactions: [lunch, groceries, bus, misc, august] });
});

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};
/** An expense row: "Jedzenie, 27 września, 45,00 zł, Obiad". */
const row = (start: string) => screen.findByRole("button", { name: new RegExp(`^${start}`) });

async function openHistory() {
  const app = await renderApp("/history", { signedIn: true });
  await header("Historia wydatków");
  return app;
}

describe("where", () => {
  it("opens from the dashboard's recent expenses", async () => {
    const app = await renderApp("/", { signedIn: true });

    await press("Wszystkie wydatki");

    await header("Historia wydatków");
    expect(app).toHavePathname("/history");
  });
});

describe("period", () => {
  it("starts at the current budget period, confirmed expenses only", async () => {
    await openHistory();

    expect(screen.getByLabelText("Okres")).toHaveTextContent("10 września – 9 października");
    expect(fakeApi.transactions.list).toHaveBeenCalledWith({
      from: "2026-09-10",
      to: "2026-10-09",
      status: "CONFIRMED",
      limit: 20,
    });
    expect(fakeApi.transactions.summary).toHaveBeenCalledWith({
      from: "2026-09-10",
      to: "2026-10-09",
    });
  });

  it("‹ goes to the previous period, list and chart with it", async () => {
    await openHistory();

    await press("Poprzedni okres");

    expect(screen.getByLabelText("Okres")).toHaveTextContent("10 sierpnia – 9 września");
    expect(await row("Jedzenie, 20 sierpnia")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Transport/ })).not.toBeOnTheScreen();
    expect(fakeApi.transactions.summary).toHaveBeenLastCalledWith({
      from: "2026-08-10",
      to: "2026-09-09",
    });
  });

  it("› is off on the current period — there is no future to look at", async () => {
    await openHistory();

    expect(screen.getByRole("button", { name: "Następny okres" })).toBeDisabled();
    await press("Poprzedni okres");
    expect(screen.getByRole("button", { name: "Następny okres" })).toBeEnabled();
  });
});

describe("list", () => {
  it("shows each expense: category, date, exact amount and the note", async () => {
    await openHistory();

    const lunchRow = within(await row("Jedzenie, 27 września"));
    expect(lunchRow.getByText(zl("45,00 zł"))).toBeOnTheScreen();
    expect(lunchRow.getByText("Obiad")).toBeOnTheScreen();
    // Role names are matched after whitespace normalisation: a plain space here.
    expect(await row("Bez kategorii, 15 września, 50,00 zł")).toBeOnTheScreen();
  });

  it("filters by category", async () => {
    await openHistory();

    await fireEvent.press(await screen.findByRole("radio", { name: "Transport" }));

    expect(await row("Transport, 20 września")).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Jedzenie, 27/ })).not.toBeOnTheScreen();
    });
    expect(fakeApi.transactions.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: transport.id }),
    );
  });

  it("„Wszystkie” clears the category filter", async () => {
    await openHistory();
    await fireEvent.press(await screen.findByRole("radio", { name: "Transport" }));

    await fireEvent.press(screen.getByRole("radio", { name: "Wszystkie" }));

    expect(screen.getByRole("radio", { name: "Wszystkie" })).toBeSelected();
    expect(await row("Jedzenie, 27 września")).toBeOnTheScreen();
  });

  it("loads 20 at a time; „Pokaż więcej” brings the next page", async () => {
    seedFakeServer({
      transactions: Array.from({ length: 25 }, (_, i) =>
        expense({ amount: 1_000 + i, date: "2026-09-20" }),
      ),
    });
    await openHistory();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Jedzenie, 20 września/ })).toHaveLength(20);
    });
    await press("Pokaż więcej");

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /^Jedzenie, 20 września/ })).toHaveLength(25);
    });
    expect(screen.queryByRole("button", { name: "Pokaż więcej" })).not.toBeOnTheScreen();
  });

  it("has an empty state for the period", async () => {
    seedFakeServer({ transactions: [] });

    await openHistory();

    expect(await screen.findAllByText("Brak wydatków w tym okresie.")).not.toHaveLength(0);
  });

  it("and one for a category with nothing in the period", async () => {
    seedFakeServer({ transactions: [lunch] });
    await openHistory();

    await fireEvent.press(await screen.findByRole("radio", { name: "Transport" }));

    expect(
      await screen.findByText("Brak wydatków w tej kategorii w tym okresie."),
    ).toBeOnTheScreen();
  });

  it("shows a skeleton while loading", async () => {
    fakeApi.transactions.list.mockReturnValueOnce(pending());

    await openHistory();

    expect(screen.getByLabelText("Wczytywanie wydatków")).toBeOnTheScreen();
  });

  it("shows an error with a retry", async () => {
    fakeApi.transactions.list.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openHistory();

    expect(await screen.findByText("Nie udało się wczytać wydatków.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await row("Jedzenie, 27 września")).toBeOnTheScreen();
  });
});

describe("chart: spending by category", () => {
  it("one bar per category, largest first, with amount and share as text", async () => {
    await openHistory();

    const chart = within(await screen.findByTestId("category-chart"));
    const bars = await chart.findAllByRole("button");
    expect(bars.map((bar) => bar.props.accessibilityLabel as string)).toEqual([
      `Jedzenie: ${zl("450 zł")}, 56%`,
      `Transport: ${zl("300 zł")}, 38%`,
      `Bez kategorii: ${zl("50 zł")}, 6%`,
    ]);
    // The same numbers are on screen, not only in colour or bar length.
    expect(chart.getByText(zl("450 zł"))).toBeOnTheScreen();
    expect(chart.getByText("56%")).toBeOnTheScreen();
    expect(chart.getByText(`Razem ${zl("800 zł")} · 4 wydatki`)).toBeOnTheScreen();
  });

  it("the bars themselves are hidden from screen readers — the labels carry the data", async () => {
    await openHistory();

    const chart = within(await screen.findByTestId("category-chart"));
    await chart.findAllByRole("button");
    for (const bar of chart.getAllByTestId("chart-bar", { includeHiddenElements: true })) {
      expect(bar).toHaveProp("importantForAccessibility", "no-hide-descendants");
      expect(bar).toHaveProp("accessibilityElementsHidden", true);
    }
  });

  it("tapping a category's bar filters the list to it", async () => {
    await openHistory();

    await press(`Transport: ${zl("300 zł")}, 38%`);

    expect(screen.getByRole("radio", { name: "Transport" })).toBeSelected();
    expect(await row("Transport, 20 września")).toBeOnTheScreen();
  });

  it("the chart covers the whole period, whatever the category filter", async () => {
    await openHistory();
    await fireEvent.press(await screen.findByRole("radio", { name: "Transport" }));

    const chart = within(screen.getByTestId("category-chart"));
    expect(chart.getByText(`Razem ${zl("800 zł")} · 4 wydatki`)).toBeOnTheScreen();
  });

  it("has an empty state", async () => {
    seedFakeServer({ transactions: [] });

    await openHistory();

    const chart = within(await screen.findByTestId("category-chart"));
    expect(await chart.findByText("Brak wydatków w tym okresie.")).toBeOnTheScreen();
  });

  it("shows a skeleton while loading", async () => {
    fakeApi.transactions.summary.mockReturnValueOnce(pending());
    await openHistory();
    expect(screen.getByLabelText("Wczytywanie wykresu")).toBeOnTheScreen();
  });

  it("fails on its own: the list stays", async () => {
    fakeApi.transactions.summary.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await openHistory();

    expect(await screen.findByText("Nie udało się wczytać wykresu.")).toBeOnTheScreen();
    expect(await row("Jedzenie, 27 września")).toBeOnTheScreen();
  });
});
