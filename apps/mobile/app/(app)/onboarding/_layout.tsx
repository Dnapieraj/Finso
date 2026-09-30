import { Stack } from "expo-router";

import { OnboardingDraftProvider } from "../../../src/onboarding/draft-context";

/**
 * The steps are screens of their own, so the system Back (Android button,
 * iOS swipe) moves between them. The answers live in this layout, so they
 * survive going back and forth and vanish with onboarding.
 */
export default function OnboardingLayout() {
  return (
    <OnboardingDraftProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="income" />
        <Stack.Screen name="commitments" />
        <Stack.Screen name="spent" />
      </Stack>
    </OnboardingDraftProvider>
  );
}
