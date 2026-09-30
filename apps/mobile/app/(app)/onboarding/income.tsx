import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Button } from "../../../src/components/button";
import { TextField } from "../../../src/components/text-field";
import { pl } from "../../../src/messages/pl";
import {
  incomeDayShown,
  incomeNameShown,
  validateIncome,
  type IncomeErrors,
  type IncomeKind,
  type OnboardingDraft,
} from "../../../src/onboarding/draft";
import { useOnboardingDraft } from "../../../src/onboarding/draft-context";
import { ChoiceCard, OnboardingStep } from "../../../src/onboarding/step";

const t = pl.onboarding;

/**
 * Step 2: regular income (amount and day) or irregular. Irregular income
 * counts in the budget only as it comes in, so the step asks what already
 * has — otherwise the first budget would show no income at all.
 */
export default function IncomeStep() {
  const [draft, update] = useOnboardingDraft();
  const [errors, setErrors] = useState<IncomeErrors>({});

  // Opened by a link without step 1: start from the beginning.
  if (draft.periodStartDay === null) return <Redirect href="/onboarding" />;

  function change(fields: Partial<OnboardingDraft>, field: keyof IncomeErrors) {
    update(fields);
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function chooseKind(kind: IncomeKind) {
    update({ incomeKind: kind });
    setErrors({});
  }

  return (
    <OnboardingStep step={2} title={t.income.title}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t.income.kind} className="gap-3">
        <ChoiceCard
          label={t.income.regular}
          hint={t.income.regularHint}
          selected={draft.incomeKind === "REGULAR"}
          onPress={() => {
            chooseKind("REGULAR");
          }}
        />
        <ChoiceCard
          label={t.income.irregular}
          hint={t.income.irregularHint}
          selected={draft.incomeKind === "IRREGULAR"}
          onPress={() => {
            chooseKind("IRREGULAR");
          }}
        />
      </View>
      <TextField
        label={t.income.name}
        value={incomeNameShown(draft)}
        onChangeText={(text) => {
          change({ incomeName: text }, "name");
        }}
        error={errors.name}
      />
      {draft.incomeKind === "REGULAR" ? (
        <>
          <TextField
            label={t.income.amount}
            value={draft.incomeAmount}
            onChangeText={(text) => {
              change({ incomeAmount: text }, "amount");
            }}
            error={errors.amount}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t.income.day}
            hint={t.income.dayHint}
            value={incomeDayShown(draft)}
            onChangeText={(text) => {
              change({ incomeDay: text }, "day");
            }}
            error={errors.day}
            keyboardType="number-pad"
          />
        </>
      ) : (
        <TextField
          label={t.income.received}
          hint={t.income.receivedHint}
          value={draft.received}
          onChangeText={(text) => {
            change({ received: text }, "received");
          }}
          error={errors.received}
          keyboardType="decimal-pad"
        />
      )}
      <Button
        onPress={() => {
          const result = validateIncome(draft);
          if (!result.ok) {
            setErrors(result.errors);
            return;
          }
          update({ income: result.income });
          router.push("/onboarding/commitments");
        }}
      >
        {t.next}
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
