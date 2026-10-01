import { ApiError } from "@vireo/shared/api";
import { cleanup, fireEvent, screen, waitFor, within } from "expo-router/testing-library";

import {
  fakeApi,
  pending,
  startBeforeOnboarding,
  testCategory,
  testUser,
} from "./helpers/fake-api";
import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";
import { queryTab } from "./helpers/tabs";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const bills = {
  ...testCategory,
  id: "01923b6e-0000-7000-8000-000000000022",
  name: "Rachunki",
  icon: "bills",
};

/** The zone the phone is set to — onboarding sends it as the user's zone. */
const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

beforeEach(() => {
  resetSecureStore();
  startBeforeOnboarding();
  fakeApi.categories.list.mockResolvedValue([testCategory, bills]);
});

/**
 * Network errors and 5xx are retried twice (src/query-client.ts), so the
 * account check only fails once all three attempts have failed.
 */
function failAllAttempts(mock: jest.Mock, error: Error) {
  mock.mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error);
}
/** Retries wait 1 s, then 2 s. */
const AFTER_RETRIES = { timeout: 5000 };

const header = (name: string) => screen.findByRole("header", { name });
const press = async (name: string) => {
  await fireEvent.press(screen.getByRole("button", { name }));
};
const type = async (label: string, text: string) => {
  await fireEvent.changeText(screen.getByLabelText(label), text);
};

async function openOnboarding() {
  const app = await renderApp("/", { signedIn: true });
  await header("Kiedy dostajesz wypłatę?");
  return app;
}

/** Step 1 → step 2 with payday on the `day`th. */
async function choosePayday(day: string) {
  await fireEvent.press(screen.getByRole("radio", { name: day }));
  await press("Dalej");
  await header("Twój dochód");
}

/** Step 2 → step 3 with a regular income. */
async function enterRegularIncome(amount: string, day?: string) {
  await type("Kwota miesięcznie", amount);
  if (day !== undefined) await type("Dzień wpływu", day);
  await press("Dalej");
  await header("Stałe zobowiązania");
}

async function addCommitment(name: string, amount: string, day: string, category: string) {
  await press("Dodaj zobowiązanie");
  await type("Nazwa", name);
  await type("Kwota", amount);
  await type("Dzień płatności", day);
  await fireEvent.press(await screen.findByRole("radio", { name: category }));
  await press("Dodaj");
}

/** The whole happy path up to step 3. */
async function reachCommitments() {
  const app = await openOnboarding();
  await choosePayday("10");
  await enterRegularIncome("8000");
  return app;
}

/** Step 3 → step 4: "Pomiń" with no commitments listed, "Dalej" with some. */
async function toSpending(button: "Pomiń" | "Dalej" = "Pomiń") {
  await press(button);
  await header("Ile już wydano od ostatniej wypłaty?");
}

/** Skips steps 3 and 4, which finishes onboarding. */
async function skipToFinish() {
  await toSpending();
  await press("Pomiń");
}

describe("when it shows", () => {
  it("a signed-in user who has not finished it lands on it instead of the dashboard", async () => {
    const app = await openOnboarding();

    expect(app).toHavePathname("/onboarding");
    expect(queryTab("Start")).not.toBeOnTheScreen();
    expect(fakeApi.budget.current).not.toHaveBeenCalled();
  });

  it("other screens of the app are out of reach until it is finished", async () => {
    const app = await renderApp("/settings", { signedIn: true });

    await header("Kiedy dostajesz wypłatę?");
    expect(app).toHavePathname("/onboarding");
  });

  it("opens straight after registration, without asking the API who the user is", async () => {
    const app = await renderApp("/register", { signedIn: false });
    await header("Załóż konto");
    await type("E-mail", "ola@example.com");
    await type("Hasło", "tajne-haslo-123");
    await press("Załóż konto");

    await header("Kiedy dostajesz wypłatę?");
    expect(app).toHavePathname("/onboarding");
    // The register response already says onboarding is not done.
    expect(fakeApi.users.me).not.toHaveBeenCalled();
  });

  it("opens after logging in to an account that quit it halfway (e.g. on another phone)", async () => {
    const app = await renderApp("/login", { signedIn: false });
    await header("Zaloguj się");
    await type("E-mail", "ola@example.com");
    await type("Hasło", "tajne-haslo-123");
    await press("Zaloguj się");

    await header("Kiedy dostajesz wypłatę?");
    expect(app).toHavePathname("/onboarding");
  });

  it("never shows again once finished", async () => {
    const app = await reachCommitments();
    await skipToFinish();
    await header("Twój budżet");
    await cleanup();

    // The next launch.
    await renderApp("/onboarding", { signedIn: true });

    await header("Twój budżet");
    expect(app).toHavePathname("/");
  });

  it("an account onboarded before never sees it", async () => {
    fakeApi.users.me.mockResolvedValueOnce(testUser);

    const app = await renderApp("/onboarding", { signedIn: true });

    await header("Twój budżet");
    expect(app).toHavePathname("/");
  });

  it("quitting halfway saves nothing and the next launch starts it from the beginning", async () => {
    await openOnboarding();
    await choosePayday("10");
    await enterRegularIncome("8000");
    await cleanup();

    await renderApp("/", { signedIn: true });

    await header("Kiedy dostajesz wypłatę?");
    expect(screen.getByRole("radio", { name: "10" })).not.toBeSelected();
    expect(fakeApi.users.completeOnboarding).not.toHaveBeenCalled();
  });

  it("shows a skeleton while checking the account", async () => {
    fakeApi.users.me.mockReturnValueOnce(pending());

    await renderApp("/", { signedIn: true });

    expect(await screen.findByLabelText("Wczytywanie konta")).toBeOnTheScreen();
    expect(queryTab("Start")).not.toBeOnTheScreen();
  });

  it("shows an error with a retry when the account cannot be checked", async () => {
    failAllAttempts(fakeApi.users.me, new ApiError("network", null, "Network request failed"));

    await renderApp("/", { signedIn: true });

    expect(
      await screen.findByText("Nie udało się wczytać konta.", {}, AFTER_RETRIES),
    ).toBeOnTheScreen();
    await press("Spróbuj ponownie");
    await header("Kiedy dostajesz wypłatę?");
  });

  it("the user can log out from it (e.g. wrong account)", async () => {
    const app = await openOnboarding();

    await press("Wyloguj się");

    await waitFor(() => {
      expect(app).toHavePathname("/login");
    });
  });
});

describe("step 1: payday", () => {
  it("says which step of three this is", async () => {
    await openOnboarding();

    expect(screen.getByText("Krok 1 z 4")).toBeOnTheScreen();
  });

  it("offers days 1–28 and explains what to pick for a payday on the 29th–31st", async () => {
    await openOnboarding();

    expect(screen.getByRole("radio", { name: "1" })).toBeOnTheScreen();
    expect(screen.getByRole("radio", { name: "28" })).toBeOnTheScreen();
    expect(screen.queryByRole("radio", { name: "29" })).not.toBeOnTheScreen();
    expect(screen.getByText("Dostajesz ją 29., 30. lub 31.? Wybierz 28.")).toBeOnTheScreen();
  });

  it("marks the chosen day as selected", async () => {
    await openOnboarding();

    await fireEvent.press(screen.getByRole("radio", { name: "10" }));

    expect(screen.getByRole("radio", { name: "10" })).toBeSelected();
  });

  it("will not go on without a day", async () => {
    const app = await openOnboarding();

    await press("Dalej");

    expect(screen.getByText("Wybierz dzień wypłaty.")).toBeOnTheScreen();
    expect(app).toHavePathname("/onboarding");
  });

  it("goes on to income", async () => {
    const app = await openOnboarding();

    await choosePayday("10");

    expect(app).toHavePathname("/onboarding/income");
    expect(screen.getByText("Krok 2 z 4")).toBeOnTheScreen();
  });
});

describe("step 2: income", () => {
  async function openIncome() {
    const app = await openOnboarding();
    await choosePayday("10");
    return app;
  }

  it("regular is the default, with the income day pre-filled from the payday", async () => {
    await openIncome();

    expect(screen.getByRole("radio", { name: "Stały" })).toBeSelected();
    expect(screen.getByLabelText("Dzień wpływu")).toHaveDisplayValue("10");
  });

  it("regular: needs a valid amount", async () => {
    await openIncome();

    await press("Dalej");
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();

    await type("Kwota miesięcznie", "8000,123");
    await press("Dalej");
    expect(screen.getByText("Kwota może mieć najwyżej 2 miejsca po przecinku.")).toBeOnTheScreen();
  });

  it.each(["0", "32", "", "5,5", "abc"])("regular: rejects '%s' as the income day", async (day) => {
    const app = await openIncome();
    await type("Kwota miesięcznie", "8000");

    await type("Dzień wpływu", day);
    await press("Dalej");

    expect(screen.getByText("Podaj dzień od 1 do 31.")).toBeOnTheScreen();
    expect(app).toHavePathname("/onboarding/income");
  });

  it("regular: accepts the 31st — shorter months pay on their last day", async () => {
    const app = await openIncome();

    await enterRegularIncome("8000", "31");

    expect(app).toHavePathname("/onboarding/commitments");
  });

  it("irregular: asks only what came in this period, and it is optional", async () => {
    const app = await openIncome();

    await fireEvent.press(screen.getByRole("radio", { name: "Nieregularny" }));

    expect(screen.queryByLabelText("Kwota miesięcznie")).not.toBeOnTheScreen();
    expect(screen.queryByLabelText("Dzień wpływu")).not.toBeOnTheScreen();
    expect(screen.getByLabelText("Ile już wpłynęło w tym okresie?")).toBeOnTheScreen();
    await press("Dalej");
    await header("Stałe zobowiązania");
    expect(app).toHavePathname("/onboarding/commitments");
  });

  it("irregular: an amount typed in must be valid", async () => {
    await openIncome();
    await fireEvent.press(screen.getByRole("radio", { name: "Nieregularny" }));

    await type("Ile już wpłynęło w tym okresie?", "0");
    await press("Dalej");

    expect(screen.getByText("Kwota musi być większa od zera.")).toBeOnTheScreen();
  });

  it("names the income 'Wypłata' by default, and the name can be changed", async () => {
    await openIncome();

    expect(screen.getByLabelText("Nazwa dochodu")).toHaveDisplayValue("Wypłata");
  });

  it("switching to irregular changes a default name to 'Dochód nieregularny'", async () => {
    await openIncome();

    await fireEvent.press(screen.getByRole("radio", { name: "Nieregularny" }));

    expect(screen.getByLabelText("Nazwa dochodu")).toHaveDisplayValue("Dochód nieregularny");
  });

  it("a name typed by hand survives switching the kind", async () => {
    await openIncome();
    await type("Nazwa dochodu", "Pensja z Biedronki");

    await fireEvent.press(screen.getByRole("radio", { name: "Nieregularny" }));

    expect(screen.getByLabelText("Nazwa dochodu")).toHaveDisplayValue("Pensja z Biedronki");
  });

  it("a name longer than 100 characters is refused", async () => {
    await openIncome();
    await type("Kwota miesięcznie", "8000");

    await type("Nazwa dochodu", "x".repeat(101));
    await press("Dalej");

    expect(screen.getByText("Nazwa może mieć najwyżej 100 znaków.")).toBeOnTheScreen();
  });

  it("Wstecz returns to the payday with the choice kept", async () => {
    const app = await openIncome();

    await press("Wstecz");

    await header("Kiedy dostajesz wypłatę?");
    expect(app).toHavePathname("/onboarding");
    expect(screen.getByRole("radio", { name: "10" })).toBeSelected();
  });

  it("changing the payday afterwards moves the pre-filled income day with it", async () => {
    await openIncome();
    await press("Wstecz");
    await header("Kiedy dostajesz wypłatę?");

    await choosePayday("25");

    expect(screen.getByLabelText("Dzień wpływu")).toHaveDisplayValue("25");
  });

  it("an income day typed by hand stays when going back and forth", async () => {
    await openIncome();
    await type("Dzień wpływu", "12");
    await press("Wstecz");
    await header("Kiedy dostajesz wypłatę?");

    await choosePayday("25");

    expect(screen.getByLabelText("Dzień wpływu")).toHaveDisplayValue("12");
  });
});

describe("step 3: fixed commitments", () => {
  it("says what belongs here and that the step can be skipped", async () => {
    await reachCommitments();

    expect(screen.getByText("Krok 3 z 4")).toBeOnTheScreen();
    expect(
      screen.getByText("Czynsz, rachunki, abonamenty — to, co płacisz co miesiąc."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pomiń" })).toBeOnTheScreen();
  });

  it("next to Pomiń, says the commitments can be added later in Settings", async () => {
    await reachCommitments();

    expect(screen.getByText("Dodasz je później w Ustawieniach.")).toBeOnTheScreen();

    await addCommitment("Czynsz", "2500", "5", "Rachunki");

    expect(screen.queryByText("Dodasz je później w Ustawieniach.")).not.toBeOnTheScreen();
  });

  it("adds a commitment and lists it with its amount and day", async () => {
    await reachCommitments();

    await addCommitment("Czynsz", "2500", "5", "Rachunki");

    const item = screen.getByTestId("commitment-0");
    expect(within(item).getByText("Czynsz")).toBeOnTheScreen();
    expect(within(item).getByText(`${zl("2500 zł")} · 5. dnia miesiąca`)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Dalej" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pomiń" })).not.toBeOnTheScreen();
  });

  it("hides the next-step button while the form is open, so nothing typed gets lost", async () => {
    await reachCommitments();

    await press("Dodaj zobowiązanie");

    expect(screen.queryByRole("button", { name: "Pomiń" })).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Dalej" })).not.toBeOnTheScreen();
  });

  it("validates every field of the commitment", async () => {
    await reachCommitments();
    await press("Dodaj zobowiązanie");

    await press("Dodaj");

    expect(screen.getByText("Podaj nazwę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj kwotę.")).toBeOnTheScreen();
    expect(screen.getByText("Podaj dzień od 1 do 31.")).toBeOnTheScreen();
    expect(screen.getByText("Wybierz kategorię.")).toBeOnTheScreen();
    expect(screen.queryByTestId("commitment-0")).not.toBeOnTheScreen();
  });

  it("Anuluj closes the form without adding anything", async () => {
    await reachCommitments();
    await press("Dodaj zobowiązanie");
    await type("Nazwa", "Czynsz");

    await press("Anuluj");

    expect(screen.queryByTestId("commitment-0")).not.toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Pomiń" })).toBeOnTheScreen();
  });

  it("the next commitment starts with an empty form", async () => {
    await reachCommitments();
    await addCommitment("Czynsz", "2500", "5", "Rachunki");

    await press("Dodaj zobowiązanie");

    expect(screen.getByLabelText("Nazwa")).toHaveDisplayValue("");
    expect(screen.getByRole("radio", { name: "Rachunki" })).not.toBeSelected();
  });

  it("removes a commitment from the list", async () => {
    await reachCommitments();
    await addCommitment("Czynsz", "2500", "5", "Rachunki");
    await addCommitment("Netflix", "60", "15", "Rachunki");

    await press("Usuń Czynsz");

    expect(screen.queryByText("Czynsz")).not.toBeOnTheScreen();
    expect(within(screen.getByTestId("commitment-0")).getByText("Netflix")).toBeOnTheScreen();
  });

  it("shows a skeleton while categories load", async () => {
    fakeApi.categories.list.mockReturnValueOnce(pending());
    await reachCommitments();

    await press("Dodaj zobowiązanie");

    expect(screen.getByLabelText("Wczytywanie kategorii")).toBeOnTheScreen();
  });

  it("shows an error with a retry when categories cannot be loaded", async () => {
    fakeApi.categories.list.mockRejectedValueOnce(
      new ApiError("invalid-response", 200, "Response does not match the schema"),
    );
    await reachCommitments();
    await press("Dodaj zobowiązanie");

    expect(await screen.findByText("Nie udało się wczytać kategorii.")).toBeOnTheScreen();
    await press("Spróbuj ponownie");

    expect(await screen.findByRole("radio", { name: "Rachunki" })).toBeOnTheScreen();
  });

  it("Wstecz returns to income with the amount kept", async () => {
    const app = await reachCommitments();

    await press("Wstecz");

    await header("Twój dochód");
    expect(app).toHavePathname("/onboarding/income");
    expect(screen.getByLabelText("Kwota miesięcznie")).toHaveDisplayValue("8000");
  });

  it("commitments added stay when going back to income and forward again", async () => {
    await reachCommitments();
    await addCommitment("Czynsz", "2500", "5", "Rachunki");
    await press("Wstecz");
    await header("Twój dochód");

    await press("Dalej");

    await header("Stałe zobowiązania");
    expect(within(screen.getByTestId("commitment-0")).getByText("Czynsz")).toBeOnTheScreen();
  });

  it("goes on to what was spent since payday", async () => {
    const app = await reachCommitments();

    await toSpending();

    expect(app).toHavePathname("/onboarding/spent");
  });
});

describe("step 4: spent since payday", () => {
  async function openSpending() {
    const app = await reachCommitments();
    await toSpending();
    return app;
  }

  it("says which step this is and what not to count twice", async () => {
    await openSpending();

    expect(screen.getByText("Krok 4 z 4")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Bez stałych zobowiązań z poprzedniego kroku — te liczymy osobno. Zapiszemy to jako jeden wydatek „Wydatki przed Finso”.",
      ),
    ).toBeOnTheScreen();
  });

  it("is optional: 'Pomiń' with an empty field, 'Zakończ' once an amount is typed", async () => {
    await openSpending();
    expect(screen.getByRole("button", { name: "Pomiń" })).toBeOnTheScreen();

    await type("Kwota", "450");

    expect(screen.getByRole("button", { name: "Zakończ" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Pomiń" })).not.toBeOnTheScreen();
  });

  it.each([
    ["0", "Kwota musi być większa od zera."],
    ["450,123", "Kwota może mieć najwyżej 2 miejsca po przecinku."],
    ["abc", "Podaj kwotę w złotych, np. 12,50."],
  ])("refuses '%s' and does not save", async (typed, message) => {
    await openSpending();

    await type("Kwota", typed);
    await press("Zakończ");

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(fakeApi.users.completeOnboarding).not.toHaveBeenCalled();
  });

  it("Wstecz returns to commitments with the list kept", async () => {
    const app = await reachCommitments();
    await addCommitment("Czynsz", "2500", "5", "Rachunki");
    await toSpending("Dalej");

    await press("Wstecz");

    await header("Stałe zobowiązania");
    expect(app).toHavePathname("/onboarding/commitments");
    expect(within(screen.getByTestId("commitment-0")).getByText("Czynsz")).toBeOnTheScreen();
  });
});

describe("finishing", () => {
  it("sends everything in one request, in grosze, with the phone's time zone", async () => {
    await openOnboarding();
    await choosePayday("10");
    await type("Nazwa dochodu", "  Pensja  ");
    await enterRegularIncome("8000");
    await addCommitment("Czynsz", "2500", "5", "Rachunki");
    await addCommitment("Netflix", "59,99", "15", "Rachunki");
    await toSpending("Dalej");
    await type("Kwota", "450,50");

    await press("Zakończ");

    await waitFor(() => {
      expect(fakeApi.users.completeOnboarding).toHaveBeenCalledTimes(1);
    });
    expect(fakeApi.users.completeOnboarding).toHaveBeenCalledWith({
      periodStartDay: 10,
      timezone: deviceTimeZone,
      income: { kind: "REGULAR", name: "Pensja", amount: 800_000, dayOfMonth: 10 },
      commitments: [
        { name: "Czynsz", amount: 250_000, dayOfMonth: 5, categoryId: bills.id },
        { name: "Netflix", amount: 5_999, dayOfMonth: 15, categoryId: bills.id },
      ],
      spentThisPeriod: 45_050,
    });
  });

  it("skipping both optional steps sends no commitments and nothing spent", async () => {
    await reachCommitments();

    await skipToFinish();

    await waitFor(() => {
      expect(fakeApi.users.completeOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({ commitments: [], spentThisPeriod: null }),
      );
    });
  });

  it("an income name cleared by hand falls back to the default", async () => {
    await openOnboarding();
    await choosePayday("10");
    await type("Nazwa dochodu", "   ");
    await enterRegularIncome("8000");

    await skipToFinish();

    await waitFor(() => {
      expect(fakeApi.users.completeOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          income: { kind: "REGULAR", name: "Wypłata", amount: 800_000, dayOfMonth: 10 },
        }),
      );
    });
  });

  it.each([
    ["with what came in", "1200", 120_000],
    ["without it", "", null],
  ])("irregular income %s", async (_case, typed, receivedThisPeriod) => {
    await openOnboarding();
    await choosePayday("1");
    await fireEvent.press(screen.getByRole("radio", { name: "Nieregularny" }));
    await type("Ile już wpłynęło w tym okresie?", typed);
    await press("Dalej");
    await header("Stałe zobowiązania");

    await skipToFinish();

    await waitFor(() => {
      expect(fakeApi.users.completeOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          periodStartDay: 1,
          income: { kind: "IRREGULAR", name: "Dochód nieregularny", receivedThisPeriod },
        }),
      );
    });
  });

  it("opens the dashboard with the budget computed after saving", async () => {
    const app = await reachCommitments();

    await skipToFinish();

    await header("Twój budżet");
    expect(app).toHavePathname("/");
    expect(await screen.findByText(zl("1234 zł"))).toBeOnTheScreen();
    const saved = fakeApi.users.completeOnboarding.mock.invocationCallOrder[0] ?? Infinity;
    const [firstBudgetRead] = fakeApi.budget.current.mock.invocationCallOrder;
    expect(firstBudgetRead).toBeGreaterThan(saved);
  });

  it("Back from the dashboard does not return to onboarding", async () => {
    const app = await reachCommitments();
    await skipToFinish();
    await header("Twój budżet");

    expect(app).toHavePathname("/");
    expect(
      screen.queryByRole("header", { name: "Ile już wydano od ostatniej wypłaty?" }),
    ).not.toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Wstecz" })).not.toBeOnTheScreen();
  });

  it("blocks a second tap while saving", async () => {
    fakeApi.users.completeOnboarding.mockReturnValueOnce(pending());
    await reachCommitments();

    await skipToFinish();

    const button = await screen.findByRole("button", { name: "Zapisywanie…" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(fakeApi.users.completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it("a failed save says why, keeps everything entered and can be retried", async () => {
    fakeApi.users.completeOnboarding.mockRejectedValueOnce(
      new ApiError("network", null, "Network request failed"),
    );
    await reachCommitments();
    await addCommitment("Czynsz", "2500", "5", "Rachunki");
    await toSpending("Dalej");
    await type("Kwota", "450");

    await press("Zakończ");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.",
    );
    expect(screen.getByLabelText("Kwota")).toHaveDisplayValue("450");
    await press("Zakończ");
    await header("Twój budżet");
    expect(fakeApi.users.completeOnboarding).toHaveBeenLastCalledWith(
      expect.objectContaining({
        commitments: [expect.objectContaining({ name: "Czynsz" })],
        spentThisPeriod: 45_000,
      }),
    );
  });

  // 409: the answers were already saved — on another phone, or by an
  // earlier attempt whose response was lost. The account is set up.
  it("409 — already finished: goes on to the dashboard without an error", async () => {
    fakeApi.users.completeOnboarding.mockImplementationOnce(() => {
      fakeApi.users.me.mockResolvedValueOnce(testUser);
      return Promise.reject(new ApiError("http", 409, "Onboarding already completed"));
    });
    const app = await reachCommitments();

    await skipToFinish();

    await header("Twój budżet");
    expect(app).toHavePathname("/");
    expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
  });
});
