/**
 * In-memory stand-in for expo-secure-store, mocked globally in jest.setup.js:
 * the real module needs the iOS Keychain / Android Keystore.
 */
const items = new Map<string, string>();

export const getItemAsync = jest.fn((key: string) => Promise.resolve(items.get(key) ?? null));

export const setItemAsync = jest.fn((key: string, value: string) => {
  items.set(key, value);
  return Promise.resolve();
});

export const deleteItemAsync = jest.fn((key: string) => {
  items.delete(key);
  return Promise.resolve();
});

/** Forgets every stored item; call in `beforeEach`. */
export function resetSecureStore(): void {
  items.clear();
}
