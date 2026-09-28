// expo-router/testing-library registers these matchers at runtime but
// ships no types for them (its expect.d.ts is empty).
declare namespace jest {
  interface Matchers<R> {
    toHavePathname(pathname: string): R;
    toHavePathnameWithParams(pathnameWithParams: string): R;
    toHaveSegments(segments: string[]): R;
  }
}
