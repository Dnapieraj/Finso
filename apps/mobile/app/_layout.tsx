import "../global.css";

// Per-weight paths: the package root would bundle every weight of the family.
import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque/700Bold";
import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk/400Regular";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk/600SemiBold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Appearance, useColorScheme, View } from "react-native";

import { theme } from "@vireo/tokens";

// Imported for its side effect: it validates EXPO_PUBLIC_API_URL at startup.
import "../src/api";
import {
  appearance,
  TEXT_SCALES,
  useAppearance,
  useAppearanceLoaded,
} from "../src/appearance/store";
import { LockGate } from "../src/lock/lock-gate";
import { appLock, useAppLock } from "../src/lock/store";
import { OfflineBar } from "../src/network/offline-bar";
import {
  devicePreferences,
  useDevicePreferencesLoaded,
} from "../src/preferences/device-preferences";
import { queryClient } from "../src/query-client";
import { session, useSession } from "../src/session";
import { textScaleVars, themeVars } from "../src/theme";
import { useUpdateRequired } from "../src/update/store";
import { UpdateRequiredScreen } from "../src/update/update-required-screen";

// Keep the splash screen until the fonts load, so text never flashes in a fallback font.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const choice = useAppearance();
  const appearanceLoaded = useAppearanceLoaded();
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";
  const scheme = choice.theme === "system" ? systemScheme : choice.theme;
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
  });
  const { status } = useSession();
  const lockLoaded = useAppLock().loaded;
  const preferencesLoaded = useDevicePreferencesLoaded();
  const mustUpdate = useUpdateRequired();
  // A font that fails to load must not block the app; system fonts take over.
  // Waiting for the session keeps login from flashing before the app opens,
  // and waiting for the lock and the privacy mode keeps amounts from flashing
  // before they are covered or hidden.
  const ready =
    (fontsLoaded || fontError !== null) &&
    status !== "restoring" &&
    appearanceLoaded &&
    lockLoaded &&
    preferencesLoaded;

  useEffect(() => {
    // Only at app start: restoring again would blank the whole tree and
    // remount the navigator, losing where the user was.
    if (session.getState().status === "restoring") void session.restore();
    void appearance.load();
    void appLock.load();
    void devicePreferences.load();
  }, []);

  useEffect(() => {
    // Native parts (switches, keyboard, status bar, date pickers) follow
    // this, not the CSS variables; "unspecified" hands it back to the phone.
    Appearance.setColorScheme(choice.theme === "system" ? "unspecified" : choice.theme);
  }, [choice.theme]);

  useEffect(() => {
    // The native window behind the screens: without it Android shows white
    // under the keyboard and during transitions in the dark theme.
    void SystemUI.setBackgroundColorAsync(theme.colors[scheme].background);
  }, [scheme]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <View
        testID="app-root"
        style={[themeVars[scheme], textScaleVars(TEXT_SCALES[choice.textSize])]}
        className="flex-1 bg-background"
      >
        {mustUpdate ? (
          <UpdateRequiredScreen />
        ) : (
          <LockGate active={status === "signed-in"}>
            <Stack
              screenOptions={{
                headerShown: false,
                // Native screen containers do not see the CSS variables; without
                // this they paint white behind a dark screen during transitions.
                contentStyle: { backgroundColor: theme.colors[scheme].background },
              }}
            >
              {/* A guard turning false removes its screens from history and
              redirects to the first allowed one: logout lands on login,
              and Back cannot return to the app. */}
              <Stack.Protected guard={status === "signed-in"}>
                <Stack.Screen name="(app)" />
              </Stack.Protected>
              <Stack.Protected guard={status !== "signed-in"}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          </LockGate>
        )}
        <OfflineBar />
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}
