import { Tabs } from "expo-router";
// Per-icon imports: the package entry pulls in all ~1500 icons.
import Calculator from "lucide-react-native/icons/calculator";
import House from "lucide-react-native/icons/house";
import Settings from "lucide-react-native/icons/settings";
import Target from "lucide-react-native/icons/target";

import { theme } from "@vireo/tokens";
import { Text, useColorScheme } from "react-native";

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
        // A quarter of the screen is narrow for "Symulator" at a large font:
        // the label shrinks to fit instead of being cut to "Symula…". A custom
        // label drops the default spoken name, so each tab sets its own.
        tabBarLabel: ({ color, children }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            // The bar keeps its height; past ×1.3 labels would run under the
            // system navigation. The icon and the spoken name carry the rest.
            maxFontSizeMultiplier={1.3}
            style={{ color, fontFamily: "HankenGrotesk_600SemiBold", fontSize: 12 }}
          >
            {children}
          </Text>
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: pl.tabs.start,
          tabBarAccessibilityLabel: pl.tabs.start,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: pl.tabs.goals,
          tabBarAccessibilityLabel: pl.tabs.goals,
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="simulator"
        options={{
          title: pl.tabs.simulator,
          tabBarAccessibilityLabel: pl.tabs.simulator,
          tabBarIcon: ({ color, size }) => <Calculator color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: pl.tabs.settings,
          tabBarAccessibilityLabel: pl.tabs.settings,
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
