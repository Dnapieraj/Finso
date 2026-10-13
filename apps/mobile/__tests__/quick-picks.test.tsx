import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import {
  billsCategory,
  fakeApi,
  seedFakeServer,
  testCategory,
  testTemplate,
  testTransaction,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);
// mockResolvedValue outlives the test (clearMocks keeps implementations).
afterEach(() => {
  fakeApi.categories.list.mockResolvedValue([testCategory]);
});

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const transport = {
  ...testCategory,
  id: "01923b6e-0000-7000-8000-000000000023",
  name: "Transport",
};

const press = async (name: string) => {
  await fireEvent.press(await screen.findByRole("button", { name }));
};

async function openQuickAdd() {
  const app = await renderApp("/", { signedIn: true });
  await press("Dodaj wydatek");
  await screen.findByRole("header", { name: "Nowy wydatek" });
  return app;
}

/** An expense saved some days ago, newest first by date. */
const earlier = (amount: number, date: string, extra: object = {}) =>
  testTransaction({
    id: `01923b6e-0000-7000-8000-0000000007${date.slice(-2)}`,
    amount,
    date,
    ...extra,
  });

describe("szablony w szybkim dodawaniu", () => {
  it("jedno tapnięcie w szablon zapisuje wydatek z jego kwotą, kategorią i nazwą jako notatką", async () => {
    seedFakeServer({ templates: [testTemplate()] });
    const app = await openQuickAdd();

    await press(`Kawa, ${zl("14,00 zł")}`);

    await waitFor(() => {
      expect(fakeApi.transactions.create).toHaveBeenCalledWith({
        input: { amount: 1_400, date: "2026-09-28", categoryId: testCategory.id, note: "Kawa" },
        idempotencyKey: expect.any(String) as unknown,
      });
    });
    expect(app).toHavePathname("/");
    expect(await screen.findByText(`Zapisano ${zl("14,00 zł")} · Kawa`)).toBeOnTheScreen();
  });

  it("wpisana kwota nie ma znaczenia — szablon ma swoją", async () => {
    seedFakeServer({ templates: [testTemplate()] });
    await openQuickAdd();
    await fireEvent.changeText(screen.getByLabelText("Kwota"), "99");

    await press(`Kawa, ${zl("14,00 zł")}`);

    await waitFor(() => {
      expect(fakeApi.transactions.create).toHaveBeenCalledTimes(1);
    });
    expect(fakeApi.transactions.create.mock.calls[0]?.[0].input.amount).toBe(1_400);
  });

  it("szablon bez kategorii (kategorię usunięto) się nie pokazuje — nie da się go zapisać", async () => {
    seedFakeServer({ templates: [testTemplate({ categoryId: null })], transactions: [] });
    await openQuickAdd();
    await screen.findByRole("button", { name: "Jedzenie" });

    expect(screen.queryByRole("button", { name: /^Kawa/ })).not.toBeOnTheScreen();
  });

  it("szablony nie wczytały się: szybkie dodawanie działa jak zwykle, bez komunikatu", async () => {
    fakeApi.expenseTemplates.list.mockRejectedValueOnce(new Error("offline"));
    seedFakeServer({ transactions: [] });
    await openQuickAdd();

    await fireEvent.changeText(screen.getByLabelText("Kwota"), "12");
    await press("Jedzenie");

    await waitFor(() => {
      expect(fakeApi.transactions.create).toHaveBeenCalledTimes(1);
    });
  });
});

describe("ostatnio używane w szybkim dodawaniu", () => {
  it("ostatnie wydatki jako gotowe pozycje: kategoria (albo notatka) i kwota", async () => {
    seedFakeServer({
      transactions: [earlier(4_590, "2026-09-27"), earlier(3_200, "2026-09-26", { note: "Obiad" })],
    });
    await openQuickAdd();

    expect(
      await screen.findByRole("button", { name: `Jedzenie, ${zl("45,90 zł")}` }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: `Obiad, ${zl("32,00 zł")}` })).toBeOnTheScreen();
  });

  it("tapnięcie zapisuje to samo jeszcze raz, z dzisiejszą datą", async () => {
    seedFakeServer({ transactions: [earlier(3_200, "2026-09-26", { note: "Obiad" })] });
    await openQuickAdd();

    await press(`Obiad, ${zl("32,00 zł")}`);

    await waitFor(() => {
      expect(fakeApi.transactions.create).toHaveBeenCalledWith({
        input: { amount: 3_200, date: "2026-09-28", categoryId: testCategory.id, note: "Obiad" },
        idempotencyKey: expect.any(String) as unknown,
      });
    });
  });

  it("powtórzenia pokazuje raz, najwyżej 4 pozycje, od najnowszych", async () => {
    seedFakeServer({
      transactions: [
        earlier(1_000, "2026-09-27"),
        earlier(1_000, "2026-09-26"),
        earlier(2_000, "2026-09-25"),
        earlier(3_000, "2026-09-24"),
        earlier(4_000, "2026-09-23"),
        earlier(5_000, "2026-09-22"),
      ],
    });
    await openQuickAdd();
    await screen.findByRole("button", { name: `Jedzenie, ${zl("10,00 zł")}` });

    const recent = screen.getAllByRole("button", { name: /^Jedzenie, / });
    expect(recent.map((button) => button.props.accessibilityLabel as string)).toEqual([
      `Jedzenie, ${zl("10,00 zł")}`,
      `Jedzenie, ${zl("20,00 zł")}`,
      `Jedzenie, ${zl("30,00 zł")}`,
      `Jedzenie, ${zl("40,00 zł")}`,
    ]);
  });

  it("pomija opłaty stałych płatności, „Wydatki przed Finso” i wydatki bez kategorii", async () => {
    fakeApi.categories.list.mockResolvedValue([testCategory, billsCategory, transport]);
    seedFakeServer({
      transactions: [
        earlier(150_000, "2026-09-27", {
          categoryId: billsCategory.id,
          recurringRuleId: "01923b6e-0000-7000-8000-000000000041",
        }),
        earlier(300_000, "2026-09-26", { beforeFinso: true, note: "Wydatki przed Finso" }),
        earlier(500, "2026-09-25", { categoryId: null }),
        earlier(480, "2026-09-24", { categoryId: transport.id }),
      ],
    });
    await openQuickAdd();

    expect(
      await screen.findByRole("button", { name: `Transport, ${zl("4,80 zł")}` }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /1500/ })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /Wydatki przed Finso/ })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Bez kategorii/ })).not.toBeOnTheScreen();
  });

  it("to, co jest już szablonem, nie powtarza się w ostatnich", async () => {
    seedFakeServer({
      templates: [testTemplate()],
      transactions: [earlier(1_400, "2026-09-27", { note: "Kawa" })],
    });
    await openQuickAdd();

    expect(await screen.findAllByRole("button", { name: /^Kawa, / })).toHaveLength(1);
  });

  it("bez szablonów i bez historii: tylko kategorie, bez pustej sekcji", async () => {
    seedFakeServer({ transactions: [] });
    await openQuickAdd();
    await screen.findByRole("button", { name: "Jedzenie" });

    expect(screen.queryByText("Szybko")).not.toBeOnTheScreen();
  });
});

describe("tryb prywatny", () => {
  it("pozycje mówią „ukryta kwota” i pokazują •••", async () => {
    seedFakeServer({ templates: [testTemplate()], transactions: [] });
    await renderApp("/", { signedIn: true });
    await press("Ukryj kwoty");
    await press("Dodaj wydatek");

    expect(await screen.findByRole("button", { name: "Kawa, ukryta kwota" })).toHaveTextContent(
      /•••/,
    );
  });
});
