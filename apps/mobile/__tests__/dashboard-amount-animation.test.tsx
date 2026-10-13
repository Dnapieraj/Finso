import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import { AccessibilityInfo } from "react-native";

import { resetSecureStore } from "./helpers/memory-secure-store";
import { renderApp } from "./helpers/render-app";

jest.mock("../src/api", () => ({
  api: jest.requireActual<{ fakeApi: unknown }>("./helpers/fake-api").fakeApi,
}));

beforeEach(resetSecureStore);

let reduceMotion: jest.SpyInstance | undefined;
afterEach(() => {
  reduceMotion?.mockRestore();
  reduceMotion = undefined;
});

/** formatMoney puts no-break spaces between digit groups and before "zł". */
const zl = (text: string) => text.replaceAll(" ", "\u00A0");

const mainAmount = () => screen.getByTestId("available-balance");

async function addExpense(amount: string) {
  await fireEvent.press(await screen.findByRole("button", { name: "Dodaj wydatek" }));
  await fireEvent.changeText(await screen.findByLabelText("Kwota"), amount);
  await fireEvent.press(await screen.findByRole("button", { name: "Jedzenie" }));
}

async function openDashboard() {
  await renderApp("/", { signedIn: true });
  await screen.findByText(zl("1234 zł"));
}

it("pierwsze wczytanie: kwota od razu, bez liczenia od zera", async () => {
  await renderApp("/", { signedIn: true });
  await screen.findByTestId("available-balance");

  expect(mainAmount()).toHaveTextContent(zl("1234 zł"));
});

it("po wydatku kwota płynnie przechodzi do nowej; czytnik ekranu od razu słyszy nową", async () => {
  await openDashboard();

  await addExpense("45,90");

  // The screen reader gets the result, not the frames in between.
  await waitFor(() => {
    expect(mainAmount()).toHaveProp("accessibilityLabel", zl("1188 zł"));
  });
  // The digits are still on their way down when the new amount is known.
  expect(mainAmount()).not.toHaveTextContent(zl("1188 zł"));
  await waitFor(
    () => {
      expect(mainAmount()).toHaveTextContent(zl("1188 zł"));
    },
    { timeout: 2_000 },
  );
});

it("„Ogranicz ruch” w telefonie: nowa kwota od razu, bez animacji", async () => {
  reduceMotion = jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
  await openDashboard();

  await addExpense("45,90");

  await waitFor(() => {
    expect(mainAmount()).toHaveProp("accessibilityLabel", zl("1188 zł"));
  });
  expect(mainAmount()).toHaveTextContent(zl("1188 zł"));
});

it("przejście pod kreskę: od razu nowa kwota pod nowym napisem", async () => {
  await openDashboard();

  // 1234,56 zł − 1300 zł = −65,44 zł, rounded up towards the user's safety.
  await addExpense("1300");

  await screen.findByText("Jesteś pod kreską o");
  expect(mainAmount()).toHaveTextContent(zl("66 zł"));
});
