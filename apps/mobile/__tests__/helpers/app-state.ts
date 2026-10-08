import { act } from "expo-router/testing-library";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Moves the app between foreground and background the way the phone does:
 * updates AppState.currentState and tells every "change" listener.
 */
const listeners = new Set<(state: AppStateStatus) => void>();

jest.spyOn(AppState, "addEventListener").mockImplementation((type, listener) => {
  if (type !== "change") return { remove: () => undefined };
  const handler = listener as (state: AppStateStatus) => void;
  listeners.add(handler);
  return { remove: () => listeners.delete(handler) };
});

export async function moveAppTo(state: AppStateStatus): Promise<void> {
  await act(async () => {
    AppState.currentState = state;
    for (const listener of [...listeners]) listener(state);
    await Promise.resolve();
  });
}

/** Back in the foreground for the next test. */
export function resetAppState(): void {
  AppState.currentState = "active";
}
