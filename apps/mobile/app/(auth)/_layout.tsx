import { Stack } from "expo-router";

/** Screens for signed-out users; the root guards send everyone else away. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
