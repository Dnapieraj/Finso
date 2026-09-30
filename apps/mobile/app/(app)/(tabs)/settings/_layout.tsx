import { Stack } from "expo-router";

/**
 * A link straight to a settings screen (e.g. /settings/income) still has
 * the settings list under it, so "Wstecz" has somewhere to go.
 */
export const unstable_settings = { initialRouteName: "index" };

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
