import appJson from "../app.json";
import { readRepoBytes, repoFileExists } from "./helpers/read-repo-file";

/** app.json paths ("./assets/…") from the repository root. */
const fromApp = (file: string) => `apps/mobile/${file.replace("./", "")}`;

/** PNG IHDR: width and height at bytes 16–23, colour type at byte 25 (2 = RGB, 6 = RGBA). */
function pngHeader(file: string) {
  const bytes = readRepoBytes(fromApp(file));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
    hasAlpha: bytes[25] === 6 || bytes[25] === 4,
  };
}

/** The image paths of the expo-splash-screen plugin in app.json. */
function splashImages(): string[] {
  for (const plugin of appJson.expo.plugins) {
    if (Array.isArray(plugin) && plugin[0] === "expo-splash-screen") {
      const options = plugin[1];
      if (typeof options === "object" && "dark" in options) {
        return [options.image, options.dark.image];
      }
    }
  }
  return [];
}

it("the store icon is 1024×1024 without an alpha channel (App Store rejects one)", () => {
  expect(pngHeader(appJson.expo.icon)).toEqual({ width: 1024, height: 1024, hasAlpha: false });
});

it("the adaptive icon has a transparent foreground and monochrome layer for Android", () => {
  const { foregroundImage, monochromeImage, backgroundImage } = appJson.expo.android.adaptiveIcon;
  expect(pngHeader(foregroundImage).hasAlpha).toBe(true);
  expect(pngHeader(monochromeImage).hasAlpha).toBe(true);
  expect(pngHeader(backgroundImage).hasAlpha).toBe(false);
});

it("the splash screen has its own image in light and dark mode", () => {
  const images = splashImages();
  expect(images).toHaveLength(2);
  for (const image of images) expect(repoFileExists(fromApp(image))).toBe(true);
});
