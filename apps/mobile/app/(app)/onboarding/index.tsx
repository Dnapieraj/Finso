import { router } from "expo-router";
import { useState } from "react";

import { useLogout } from "../../../src/auth/hooks";
import { Button } from "../../../src/components/button";
import { PaydayPicker } from "../../../src/components/payday-picker";
import { pl } from "../../../src/messages/pl";
import { useOnboardingDraft } from "../../../src/onboarding/draft-context";
import { FieldError, OnboardingStep } from "../../../src/onboarding/step";

const t = pl.onboarding;

/** Step 1: the payday, which starts the budget period. */
export default function PaydayStep() {
  const [draft, update] = useOnboardingDraft();
  const [error, setError] = useState<string | undefined>();
  const logout = useLogout();

  return (
    <OnboardingStep step={1} title={t.payday.title} intro={t.payday.intro}>
      <PaydayPicker
        value={draft.periodStartDay}
        onChange={(day) => {
          update({ periodStartDay: day });
          setError(undefined);
        }}
      />
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
