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
// Jest (CommonJS) cannot run the dynamic import() the loader uses on
// devices; hand it the fake above instead. Where notifications are
// supported is tested on its own (notificationsSupportedOn).
jest.mock("./src/notifications/native", () => ({
  ...jest.requireActual("./src/notifications/native"),
  loadNotifications: () => Promise.resolve(require("expo-notifications")),
}));

// Biometrics, the phone code screen and the app switcher do not exist under
// Jest; tests set what the phone has enrolled and read what the app hid.
jest.mock("expo-local-authentication", () =>
  require("./__tests__/helpers/fake-local-authentication"),
);
jest.mock("expo-screen-capture", () => require("./__tests__/helpers/fake-screen-capture"));
