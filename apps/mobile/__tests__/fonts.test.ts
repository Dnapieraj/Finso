import { readRepoFile } from "./helpers/read-repo-file";

/**
 * Importing a font family from its package root pulls every weight into the
 * app bundle (26 files for the two families); the app uses three. Each
 * weight comes from its own path, e.g. "@expo-google-fonts/hanken-grotesk/400Regular".
 */
describe("fonts", () => {
  const layout = readRepoFile("apps/mobile/app/_layout.tsx");
  const imports = [...layout.matchAll(/from "(@expo-google-fonts\/[^"]+)"/g)].map(
    (match) => match[1],
  );

  it("each weight is imported on its own, never the whole family", () => {
    expect(imports.sort()).toEqual([
      "@expo-google-fonts/bricolage-grotesque/700Bold",
      "@expo-google-fonts/hanken-grotesk/400Regular",
      "@expo-google-fonts/hanken-grotesk/600SemiBold",
    ]);
  });
});
