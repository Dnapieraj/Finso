/**
 * Stand-in for @sentry/react-native, mocked globally in jest.setup.js: the
 * native SDK does not run under Jest. Tests read the options `init` got.
 */
export const init = jest.fn();
export const captureException = jest.fn();

/** The real `wrap` adds a profiler; here the root component is returned as is. */
export function wrap<T>(component: T): T {
  return component;
}
