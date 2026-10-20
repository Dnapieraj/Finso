/**
 * In-memory stand-in for expo-system-ui, mocked globally in jest.setup.js:
 * there is no native root view under Jest. Tests read the colour the app
 * last painted behind its screens.
 */
let background: string | null = null;

export const setBackgroundColorAsync = jest.fn((color: string) => {
  background = color;
  return Promise.resolve();
});

export const getBackgroundColorAsync = jest.fn(() => Promise.resolve(background));

/** The colour behind the app's screens, or null if it was never set. */
export function rootBackground(): string | null {
  return background;
}
