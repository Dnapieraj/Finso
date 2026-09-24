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
  // A font that fails to load must not block the app; system fonts take over.
  const ready = fontsLoaded || fontError !== null;

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
        />
        <StatusBar style="auto" />
      </View>
    </QueryClientProvider>
  );
}
