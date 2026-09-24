import { readApiUrl } from "../src/config";

it("fails fast with a clear message when EXPO_PUBLIC_API_URL is missing", () => {
  expect(() => readApiUrl(undefined)).toThrow(/EXPO_PUBLIC_API_URL/);
  expect(() => readApiUrl("")).toThrow(/EXPO_PUBLIC_API_URL/);
});

it("rejects a value that is not an http(s) URL", () => {
  expect(() => readApiUrl("192.168.0.106:3000")).toThrow(/EXPO_PUBLIC_API_URL/);
});

it("accepts the computer's Wi-Fi address", () => {
  expect(readApiUrl("http://192.168.0.106:3000")).toBe("http://192.168.0.106:3000");
});
