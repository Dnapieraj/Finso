import { render, screen } from "@testing-library/react-native";

import StartScreen from "../app/index";

// RNTL 14 renders asynchronously: `render` returns a promise.
it("start screen shows the Finso wordmark as a header", async () => {
  await render(<StartScreen />);

  expect(screen.getByRole("header", { name: "Finso" })).toBeOnTheScreen();
  expect(screen.getByText("Czy stać cię na to teraz?")).toBeOnTheScreen();
});
