// A pattern rather than `new URL`, so the check behaves the same under Node
// (tests) and on the device.
const HTTP_URL = /^https?:\/\/[^\s/?#]+/i;

/**
 * Validates the API address baked into the bundle. Expo inlines
 * `process.env.EXPO_PUBLIC_*` only where the full name is written out, so
 * the caller passes `process.env.EXPO_PUBLIC_API_URL` in. Failing at
 * startup beats every request failing later with a vague network error.
 */
export function readApiUrl(value: string | undefined): string {
  if (!value || !HTTP_URL.test(value)) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be an http(s) address, got ${JSON.stringify(value)}. ` +
        "Set it in apps/mobile/.env to your computer's Wi-Fi IP, e.g. http://192.168.0.106:3000 " +
        "(see .env.example).",
    );
  }
  return value;
}
