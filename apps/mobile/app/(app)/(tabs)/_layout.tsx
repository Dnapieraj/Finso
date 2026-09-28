import { Tabs } from "expo-router";
// Per-icon imports: the package entry pulls in all ~1500 icons.
import House from "lucide-react-native/icons/house";
import Settings from "lucide-react-native/icons/settings";

import { theme } from "@vireo/tokens";
import { useColorScheme } from "react-native";

import { pl } from "../../../src/messages/pl";

/**
 * The signed-in app. „Ustawienia” must stay a tab: the web page
 * /usuwanie-konta tells users to find account deletion there.
 * Icons come from lucide, the same set the web uses.
 */
export default function TabsLayout() {
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarLabelStyle: { fontFamily: "HankenGrotesk_600SemiBold", fontSize: 12 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: pl.tabs.start,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: pl.tabs.settings,
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
