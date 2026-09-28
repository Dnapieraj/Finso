import { ApiError } from "@vireo/shared/api";
import { AccessibilityInfo } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import { deferred, fakeApi, pending, testCategory, testTransaction } from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const ownCategory = {
  ...testCategory,
  id: "01923b6e-0000-7000-8000-000000000021",
  name: "Hobby",
  isSystem: false,
};

async function openAddExpense() {
  const app = await renderApp("/", { signedIn: true });
  // Interaction 1: the "+" on the dashboard.
  await fireEvent.press(await screen.findByRole("button", { name: "Dodaj wydatek" }));
  await screen.findByRole("header", { name: "Nowy wydatek" });
  return app;
}

async function addExpense(amount: string, category = "Jedzenie") {
  // Interaction 2: type the amount (the field is already focused).
  await fireEvent.changeText(screen.getByLabelText("Kwota"), amount);
  // Interaction 3: tap a category, which saves.
  await fireEvent.press(await screen.findByRole("button", { name: category }));
}

describe("quick add", () => {
  it("adds an expense in 3 interactions: +, amount, category", async () => {
    const app = await openAddExpense();

    await addExpense("45,90");

    await waitFor(() => {
      expect(app).toHavePathname("/");
    });
    expect(fakeApi.transactions.create).toHaveBeenCalledWith({
      amount: 4_590,
      // "Today" in the user's time zone, as the budget computed it.
      date: "2026-09-28",
      categoryId: testCategory.id,
    });
  });

  it("opens with the amount field focused and a decimal keyboard", async () => {
    await openAddExpense();

    const amount = screen.getByLabelText("Kwota");
    expect(amount).toHaveProp("autoFocus", true);
    expect(amount).toHaveProp("keyboardType", "decimal-pad");
  });

  it("lists system and the user's own categories", async () => {
    fakeApi.categories.list.mockResolvedValueOnce([testCategory, ownCategory]);
    await openAddExpense();

    expect(await screen.findByRole("button", { name: "Jedzenie" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Hobby" })).toBeOnTheScreen();
  });

  it.each([
    ["", "Podaj kwotę."],
    ["0", "Kwota musi być większa od zera."],
    ["12,345", "Kwota może mieć najwyżej 2 miejsca po przecinku."],
    ["abc", "Podaj kwotę w złotych, np. 12,50."],
    ["99999999999", "Ta kwota jest za duża."],
  ])(
    "amount %j: a category tap explains the problem and saves nothing",
    async (amount, message) => {
      const app = await openAddExpense();

      await addExpense(amount);

      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(fakeApi.transactions.create).not.toHaveBeenCalled();
      expect(app).toHavePathname("/add-expense");
    },
  );

  it("shows loading and error states for categories", async () => {
    fakeApi.categories.list.mockReturnValueOnce(pending());
    await openAddExpense();

    expect(screen.getByLabelText("Wczytywanie kategorii")).toBeOnTheScreen();
  });

  it("offers a retry when categories cannot be loaded", async () => {
    const error = new ApiError("invalid-response", 200, "Response does not match the schema");
    // The dashboard loads categories first, and the modal refetches a
    // failed query when it opens: both attempts have to fail.
    fakeApi.categories.list.mockRejectedValueOnce(error).mockRejectedValueOnce(error);
    await openAddExpense();

    expect(await screen.findByText("Nie udało się wczytać kategorii.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Spróbuj ponownie" }));

    expect(await screen.findByRole("button", { name: "Jedzenie" })).toBeOnTheScreen();
  });

  it("closes without saving on Anuluj", async () => {
    const app = await openAddExpense();

    await fireEvent.press(screen.getByRole("button", { name: "Anuluj" }));

    await waitFor(() => {
      expect(app).toHavePathname("/");
    });
    expect(fakeApi.transactions.create).not.toHaveBeenCalled();
  });
});

describe("optimistic update", () => {
  it("shows the expense on the dashboard before the server answers", async () => {
    fakeApi.transactions.create.mockReturnValueOnce(pending());
    await openAddExpense();

    await addExpense("45,90");

    // 1234,56 zł − 45,90 zł = 1188,66 zł; per day floor(118 866 / 12) = 99,05 zł.
    expect(await screen.findByText(zl("1188 zł"))).toBeOnTheScreen();
    expect(screen.getByText(`${zl("99 zł")} dziennie`)).toBeOnTheScreen();
    const row = screen.getByLabelText(`Jedzenie, 28 września, ${zl("45,90 zł")}`);
    expect(within(row).getByText(zl("45,90 zł"))).toBeOnTheScreen();
  });

  it("refreshes the budget and expenses from the server once saved", async () => {
    // Counted before the modal opens: the dashboard under it is hidden
    // from queries (aria-hidden), as it is from screen readers.
    await renderApp("/", { signedIn: true });
    await screen.findByText(zl("1234 zł"));
    const budgetCalls = fakeApi.budget.current.mock.calls.length;
    const listCalls = fakeApi.transactions.list.mock.calls.length;
    await fireEvent.press(screen.getByRole("button", { name: "Dodaj wydatek" }));
    await screen.findByRole("header", { name: "Nowy wydatek" });

    await addExpense("45,90");

    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetCalls);
    });
    expect(fakeApi.transactions.list.mock.calls.length).toBeGreaterThan(listCalls);
  });

  it("rolls back and offers a retry when saving fails", async () => {
    fakeApi.transactions.create.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openAddExpense();

    await addExpense("45,90");

    const alert = await screen.findByRole("alert");
    // The alert also contains its retry button, hence exact: false.
    expect(alert).toHaveTextContent(`Nie udało się zapisać wydatku ${zl("45,90 zł")}.`, {
      exact: false,
    });
    // The optimistic numbers are gone: back to what the server said.
    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
    expect(
      screen.queryByLabelText(`Jedzenie, 28 września, ${zl("45,90 zł")}`),
    ).not.toBeOnTheScreen();

    await fireEvent.press(within(alert).getByRole("button", { name: "Spróbuj ponownie" }));

    expect(fakeApi.transactions.create).toHaveBeenCalledTimes(2);
    expect(fakeApi.transactions.create).toHaveBeenLastCalledWith({
      amount: 4_590,
      date: "2026-09-28",
      categoryId: testCategory.id,
    });
  });
});

describe("Cofnij", () => {
  const savedId = "01923b6e-0000-7000-8000-000000000099";
  const notice = `Zapisano ${zl("45,90 zł")} · Jedzenie`;

  it("after saving shows what was saved, with Cofnij", async () => {
    await openAddExpense();

    await addExpense("45,90");

    expect(await screen.findByText(notice)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cofnij" })).toBeOnTheScreen();
  });

  it("Cofnij deletes the expense and puts the budget back", async () => {
    await openAddExpense();
    await addExpense("45,90");
    await screen.findByText(zl("1188 zł"));

    await fireEvent.press(await screen.findByRole("button", { name: "Cofnij" }));

    await waitFor(() => {
      expect(fakeApi.transactions.remove).toHaveBeenCalledWith(savedId);
    });
    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
    expect(
      screen.queryByLabelText(`Jedzenie, 28 września, ${zl("45,90 zł")}`),
    ).not.toBeOnTheScreen();
    expect(screen.queryByText(notice)).not.toBeOnTheScreen();
  });

  it("without Cofnij the expense stays; the notice goes away after 5 s", async () => {
    await openAddExpense();
    await addExpense("45,90");
    await screen.findByText(notice);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.queryByText(notice)).not.toBeOnTheScreen();
    expect(fakeApi.transactions.remove).not.toHaveBeenCalled();
    expect(fakeApi.transactions.create).toHaveBeenCalledTimes(1);
  });

  it("Cofnij before the server answers deletes the expense once it is saved", async () => {
    const save = deferred<ReturnType<typeof testTransaction>>();
    fakeApi.transactions.create.mockReturnValueOnce(save.promise);
    await openAddExpense();
    await addExpense("45,90");

    await fireEvent.press(await screen.findByRole("button", { name: "Cofnij" }));
    // The dashboard is back to the server's numbers straight away…
    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
    expect(fakeApi.transactions.remove).not.toHaveBeenCalled();

    // …and the delete goes out as soon as the save lands, with its real id.
    await act(async () => {
      save.resolve(testTransaction({ id: savedId, amount: 4_590, date: "2026-09-28" }));
      await save.promise;
    });
    await waitFor(() => {
      expect(fakeApi.transactions.remove).toHaveBeenCalledWith(savedId);
    });
  });

  it("if Cofnij fails, says so, reloads the budget and lets the user try again", async () => {
    fakeApi.transactions.remove.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await openAddExpense();
    await addExpense("45,90");
    const budgetCalls = fakeApi.budget.current.mock.calls.length;

    await fireEvent.press(await screen.findByRole("button", { name: "Cofnij" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Nie udało się cofnąć wydatku ${zl("45,90 zł")}.`, {
      exact: false,
    });
    await waitFor(() => {
      expect(fakeApi.budget.current.mock.calls.length).toBeGreaterThan(budgetCalls);
    });

    await fireEvent.press(within(alert).getByRole("button", { name: "Spróbuj ponownie" }));

    expect(fakeApi.transactions.remove).toHaveBeenCalledTimes(2);
    expect(fakeApi.transactions.remove).toHaveBeenLastCalledWith(savedId);
  });
});

describe("Cofnij with a screen reader", () => {
  const notice = `Zapisano ${zl("45,90 zł")} · Jedzenie`;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("announces the saved expense", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    await openAddExpense();

    await addExpense("45,90");

    await waitFor(() => {
      expect(announce).toHaveBeenCalledWith(`${notice}. Cofnij`);
    });
  });

  // RN exposes no screen-reader focus events, so "stay while focused"
  // becomes "never time out while a screen reader runs" (WCAG 2.2.1).
  it("with VoiceOver/TalkBack on, the notice does not time out; Zamknij dismisses it", async () => {
    jest.spyOn(AccessibilityInfo, "isScreenReaderEnabled").mockResolvedValue(true);
    await openAddExpense();
    await addExpense("45,90");
    await screen.findByText(notice);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByText(notice)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Zamknij" }));
    expect(screen.queryByText(notice)).not.toBeOnTheScreen();
    expect(fakeApi.transactions.remove).not.toHaveBeenCalled();
  });
});
