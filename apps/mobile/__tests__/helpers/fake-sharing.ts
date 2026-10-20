/**
 * In-memory stand-in for expo-sharing, mocked globally in jest.setup.js:
 * there is no share sheet under Jest. Tests read what the app offered.
 */
let available = true;

export const isAvailableAsync = jest.fn(() => Promise.resolve(available));

export const shareAsync = jest.fn((_url: string, _options?: object) => Promise.resolve());

/** A phone without a share sheet (e.g. some web views). */
export function setSharingAvailable(value: boolean): void {
  available = value;
}

export function resetSharing(): void {
  available = true;
}
