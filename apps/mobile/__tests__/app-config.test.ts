import appJson from "../app.json";
import easJson from "../eas.json";

const { expo } = appJson;

it("ships as version 1.0.0; build numbers come from EAS (one source, never reused)", () => {
  expect(expo.version).toBe("1.0.0");
  expect(easJson.cli.appVersionSource).toBe("remote");
  expect(easJson.build.production.autoIncrement).toBe(true);
});

it("blocks Android permissions the app does not use — each one costs a store declaration", () => {
  // Import and export go through the system file picker and share sheet,
  // which need no storage or media permission.
  expect(expo.android.blockedPermissions).toEqual(
    expect.arrayContaining([
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.RECORD_AUDIO",
    ]),
  );
});

it("tells App Store Connect the app uses only exempt encryption (HTTPS)", () => {
  expect(expo.ios.config.usesNonExemptEncryption).toBe(false);
});

it("store builds talk to the production API over HTTPS; the dev build to this computer", () => {
  expect(easJson.build.production.env.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
  expect(easJson.build.preview.env.EXPO_PUBLIC_API_URL).toMatch(/^https:\/\//);
  expect(easJson.build.development.developmentClient).toBe(true);
});
