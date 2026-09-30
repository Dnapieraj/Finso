import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Screen } from "../components/screen";
import { pl } from "../messages/pl";

/** How many steps onboarding has. */
export const STEP_COUNT = 4;

/** One onboarding step: heading, "Krok N z 4", an optional intro and the content. */
export function OnboardingStep({
  step,
  title,
  intro,
  children,
}: {
  step: number;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Screen title={title}>
      <View className="-mt-3 gap-2">
        <Text className="font-sans-semibold text-sm text-muted-foreground">
          {pl.onboarding.step(step, STEP_COUNT)}
        </Text>
        {intro ? <Text className="font-sans text-base text-foreground">{intro}</Text> : null}
      </View>
      {children}
    </Screen>
  );
}

/** A larger radio option with a line of explanation under its label. */
export function ChoiceCard({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`gap-1 rounded-2xl border-2 px-4 py-3 active:opacity-80 ${
        selected ? "border-primary bg-card" : "border-input bg-background"
      }`}
    >
      <Text className="font-sans-semibold text-base text-foreground">{label}</Text>
      <Text className="font-sans text-sm text-muted-foreground">{hint}</Text>
    </Pressable>
  );
}

/** An error under a group of choices, where no text field can show it. */
export function FieldError({ children }: { children?: string }) {
  return children ? <Text className="font-sans text-sm text-destructive">{children}</Text> : null;
}
