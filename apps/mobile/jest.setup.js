// The real module talks to native code that does not exist under Jest.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// Keychain / Keystore do not exist under Jest; tests share an in-memory store.
jest.mock("expo-secure-store", () => require("./__tests__/helpers/memory-secure-store"));

// CI has no .env; src/api.ts refuses to start without an API address.
process.env.EXPO_PUBLIC_API_URL ??= "http://api.test";

// The OS notification centre does not exist under Jest; tests read what the app scheduled.
jest.mock("expo-notifications", () => require("./__tests__/helpers/fake-notifications"));
