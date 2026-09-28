import "../global.css";

import { BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_600SemiBold,
} from "@expo-google-fonts/hanken-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme, View } from "react-native";

import { theme } from "@vireo/tokens";

// Imported for its side effect: it validates EXPO_PUBLIC_API_URL at startup.
import "../src/api";
import { queryClient } from "../src/query-client";
import { session, useSession } from "../src/session";
import { themeVars } from "../src/theme";

// Keep the splash screen until the fonts load, so text never flashes in a fallback font.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
  });
  const { status } = useSession();
  // A font that fails to load must not block the app; system fonts take over.
  // Waiting for the session keeps login from flashing before the app opens.
  const ready = (fontsLoaded || fontError !== null) && status !== "restoring";

  useEffect(() => {
    // Only at app start: restoring again would blank the whole tree and
    // remount the navigator, losing where the user was.
    if (session.getState().status === "restoring") void session.restore();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <View style={themeVars[scheme]} className="flex-1 bg-background">
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
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}
