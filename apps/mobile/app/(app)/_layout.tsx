import { Stack } from "expo-router";

/**
 * The signed-in app: the tabs, with the quick add presented over them as
 * a modal. A group, so the URLs stay "/" and "/settings".
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
    </Stack>
  );
}
