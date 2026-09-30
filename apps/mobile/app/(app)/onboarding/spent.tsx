import { Redirect, router } from "expo-router";
import { useState } from "react";

import { apiErrorMessage } from "../../../src/auth/api-error-message";
import { Button } from "../../../src/components/button";
import { FormAlert } from "../../../src/components/form-alert";
import { TextField } from "../../../src/components/text-field";
import { pl } from "../../../src/messages/pl";
import { deviceTimeZone, parseOptionalAmount } from "../../../src/onboarding/draft";
import { useOnboardingDraft } from "../../../src/onboarding/draft-context";
import { OnboardingStep } from "../../../src/onboarding/step";
import { useCompleteOnboarding } from "../../../src/onboarding/use-complete-onboarding";

const t = pl.onboarding;

/**
 * Step 4: what was spent since payday, before the app. Without it the
 * first budget counts the whole period's income as still available.
 * Asked after the commitments, so the hint can say not to count them
 * again: the budget subtracts those on its own.
 *
 * Saving everything happens here; success switches the guards to the app.
 */
export default function SpentStep() {
  const [draft, update] = useOnboardingDraft();
  const [error, setError] = useState<string | undefined>();
  const complete = useCompleteOnboarding();

  // Opened by a link without the earlier steps: start from the beginning.
  if (draft.periodStartDay === null || draft.income === null) {
    return <Redirect href="/onboarding" />;
  }
  const { periodStartDay, income } = draft;

  function finish() {
    const spent = parseOptionalAmount(draft.spent);
    if (!spent.ok) {
      setError(spent.message);
      return;
    }
    complete.mutate({
      periodStartDay,
      timezone: deviceTimeZone(),
      income,
      commitments: draft.commitments.map(({ name, amount, dayOfMonth, category }) => ({
        name,
        amount,
        dayOfMonth,
        categoryId: category.id,
      })),
      spentThisPeriod: spent.grosze,
    });
  }

  return (
    <OnboardingStep step={4} title={t.spent.title}>
      {complete.isError && (
        <FormAlert tone="error">{apiErrorMessage(complete.error, "onboarding")}</FormAlert>
      )}
      <TextField
        label={t.spent.amount}
        hint={t.spent.hint}
        value={draft.spent}
        onChangeText={(text) => {
          update({ spent: text });
          setError(undefined);
        }}
        error={error}
        keyboardType="decimal-pad"
      />
      <Button loading={complete.isPending} loadingLabel={t.saving} onPress={finish}>
        {draft.spent.trim() === "" ? t.skip : t.finish}
      </Button>
      <Button
        variant="ghost"
        onPress={() => {
          router.back();
        }}
      >
        {t.back}
      </Button>
    </OnboardingStep>
  );
}
