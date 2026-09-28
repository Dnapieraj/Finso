import { Tabs } from "expo-router";

import { theme } from "@vireo/tokens";
import { useColorScheme } from "react-native";

import { pl } from "../../src/messages/pl";

/**
 * The signed-in app. „Ustawienia” must stay a tab: the web page
 * /usuwanie-konta tells users to find account deletion there.
 * No icons yet; they get picked together with the dashboard.
 */
export default function AppLayout() {
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: "none" },
        tabBarLabelPosition: "beside-icon",
        tabBarLabelStyle: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 15 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: pl.tabs.start }} />
      <Tabs.Screen name="settings" options={{ title: pl.tabs.settings }} />
    </Tabs>
  );
}
