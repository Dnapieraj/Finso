import * as SecureStore from "expo-secure-store";

import { secureTokenStore } from "../src/secure-token-store";

// In-memory stand-in: the real module needs the iOS Keychain / Android Keystore.
jest.mock("expo-secure-store", () => {
  const items = new Map<string, string>();
  return {
    setItemAsync: jest.fn((key: string, value: string) => {
      items.set(key, value);
      return Promise.resolve();
    }),
    getItemAsync: jest.fn((key: string) => Promise.resolve(items.get(key) ?? null)),
    deleteItemAsync: jest.fn((key: string) => {
      items.delete(key);
      return Promise.resolve();
    }),
  };
});

const tokens = { accessToken: "access", refreshToken: "refresh", accessTokenExpiresIn: 900 };

it("saves both tokens under separate keys and reads them back", async () => {
  await secureTokenStore.setTokens(tokens);

  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("finso.accessToken", "access");
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("finso.refreshToken", "refresh");
  await expect(secureTokenStore.getAccessToken()).resolves.toBe("access");
  await expect(secureTokenStore.getRefreshToken()).resolves.toBe("refresh");
});

it("clear() deletes both tokens", async () => {
  await secureTokenStore.setTokens(tokens);
  await secureTokenStore.clear();

  await expect(secureTokenStore.getAccessToken()).resolves.toBeNull();
  await expect(secureTokenStore.getRefreshToken()).resolves.toBeNull();
});
