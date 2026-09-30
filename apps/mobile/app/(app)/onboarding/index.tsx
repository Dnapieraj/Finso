import { PERIOD_START_DAY_MAX } from "@vireo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useLogout } from "../../../src/auth/hooks";
import { Button } from "../../../src/components/button";
import { pl } from "../../../src/messages/pl";
import { useOnboardingDraft } from "../../../src/onboarding/draft-context";
import { FieldError, OnboardingStep } from "../../../src/onboarding/step";

const t = pl.onboarding;
const DAYS = Array.from({ length: PERIOD_START_DAY_MAX }, (_, i) => i + 1);

function DayChip({
  day,
  selected,
  onPress,
}: {
  day: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={String(day)}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`aspect-square w-[12%] items-center justify-center rounded-xl border ${
        selected ? "border-primary bg-primary" : "border-input bg-background"
      }`}
    >
      <Text
        className={`font-sans-semibold text-base ${
          selected ? "text-primary-foreground" : "text-foreground"
        }`}
      >
        {day}
      </Text>
    </Pressable>
  );
}

/**
 * Step 1: the payday, which starts the budget period. Only 1–28, so the
 * period starts on the same day every month (see User.periodStartDay).
 */
export default function PaydayStep() {
  const [draft, update] = useOnboardingDraft();
  const [error, setError] = useState<string | undefined>();
  const logout = useLogout();

  return (
    <OnboardingStep step={1} title={t.payday.title} intro={t.payday.intro}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.payday.days}
        className="flex-row flex-wrap gap-[2.66%] gap-y-2"
      >
        {DAYS.map((day) => (
          <DayChip
            key={day}
            day={day}
            selected={draft.periodStartDay === day}
            onPress={() => {
              update({ periodStartDay: day });
              setError(undefined);
            }}
          />
        ))}
      </View>
      <Text className="font-sans text-sm text-muted-foreground">{t.payday.lateMonthHint}</Text>
      <FieldError>{error}</FieldError>
      <Button
        onPress={() => {
          if (draft.periodStartDay === null) {
            setError(t.payday.required);
            return;
          }
          router.push("/onboarding/income");
        }}
      >
        {t.next}
      </Button>
      <Button
        variant="ghost"
        loading={logout.isPending}
        onPress={() => {
          logout.mutate();
        }}
      >
        {t.logout}
      </Button>
    </OnboardingStep>
  );
}
