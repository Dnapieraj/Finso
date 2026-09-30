import { formatMoney } from "@vireo/shared";
import { Redirect, router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Button } from "../../../src/components/button";
import { LoadError, Skeleton } from "../../../src/components/query-states";
import { TextField } from "../../../src/components/text-field";
import { useCategories } from "../../../src/dashboard/queries";
import { CategoryChip } from "../../../src/expenses/category-chip";
import { pl } from "../../../src/messages/pl";
import {
  validateCommitment,
  type CommitmentDraft,
  type CommitmentFields,
} from "../../../src/onboarding/draft";
import { useOnboardingDraft } from "../../../src/onboarding/draft-context";
import { FieldError, OnboardingStep } from "../../../src/onboarding/step";

const t = pl.onboarding;

const emptyFields: CommitmentFields = { name: "", amount: "", day: "", category: null };

type FieldErrors = Partial<Record<keyof CommitmentFields, string>>;

function CommitmentRow({
  commitment,
  index,
  onRemove,
}: {
  commitment: CommitmentDraft;
  index: number;
  onRemove: () => void;
}) {
  return (
    <View
      testID={`commitment-${String(index)}`}
      className="flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3"
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-sans-semibold text-base text-card-foreground">{commitment.name}</Text>
        <Text className="font-sans text-sm text-muted-foreground">
          {/* A cost rounds up: the list must not promise more money than there is. */}
          {t.commitments.summary(
            formatMoney(commitment.amount, { whole: "up" }),
            commitment.dayOfMonth,
          )}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.commitments.remove(commitment.name)}
        onPress={onRemove}
        className="min-h-11 justify-center px-2"
      >
        <Text className="font-sans-semibold text-sm text-destructive">
          {t.commitments.removeShort}
        </Text>
      </Pressable>
    </View>
  );
}

function CommitmentForm({
  onAdd,
  onCancel,
}: {
  onAdd: (commitment: CommitmentDraft) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const categories = useCategories();

  function change(patch: Partial<CommitmentFields>) {
    setFields((current) => ({ ...current, ...patch }));
    // A field being edited drops its own error; the others stay.
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !(key in patch))),
    );
  }

  let categoryList: ReactNode;
  if (categories.isPending) {
    categoryList = <Skeleton label={t.commitments.loadingCategories} />;
  } else if (categories.isError) {
    categoryList = (
      <LoadError
        message={t.commitments.categoriesError}
        onRetry={() => void categories.refetch()}
      />
    );
  } else {
    categoryList = (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.commitments.category}
        className="flex-row flex-wrap gap-2"
      >
        {categories.data.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            selected={category.id === fields.category?.id}
            onPress={() => {
              change({ category });
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-4 rounded-2xl border border-border p-4">
      <TextField
        label={t.commitments.name}
        value={fields.name}
        onChangeText={(name) => {
          change({ name });
        }}
        error={errors.name}
        autoFocus
      />
      <TextField
        label={t.commitments.amount}
        value={fields.amount}
        onChangeText={(amount) => {
          change({ amount });
        }}
        error={errors.amount}
        keyboardType="decimal-pad"
      />
      <TextField
        label={t.commitments.day}
        value={fields.day}
        onChangeText={(day) => {
          change({ day });
        }}
        error={errors.day}
        keyboardType="number-pad"
      />
      <View className="gap-2">
        <Text className="font-sans-semibold text-sm text-foreground">{t.commitments.category}</Text>
        {categoryList}
        <FieldError>{errors.category}</FieldError>
      </View>
      <Button
        variant="outline"
        onPress={() => {
          const result = validateCommitment(fields);
          if (result.ok) onAdd(result.commitment);
          else setErrors(result.errors);
        }}
      >
        {t.commitments.confirmAdd}
      </Button>
      <Button variant="ghost" onPress={onCancel}>
        {t.commitments.cancel}
      </Button>
    </View>
  );
}

/**
 * Step 3: rent, bills, subscriptions — each becomes a monthly expense rule.
 * Optional. While a commitment is being typed, the only way on is to add
 * or cancel it, so nothing typed is silently dropped.
 */
export default function CommitmentsStep() {
  const [draft, update] = useOnboardingDraft();
  const [adding, setAdding] = useState(false);

  // Opened by a link without the earlier steps: start from the beginning.
  if (draft.periodStartDay === null || draft.income === null) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <OnboardingStep step={3} title={t.commitments.title} intro={t.commitments.intro}>
      {draft.commitments.length > 0 && (
        <View className="gap-2">
          {draft.commitments.map((commitment, index) => (
            <CommitmentRow
              key={commitment.id}
              commitment={commitment}
              index={index}
              onRemove={() => {
                update({
                  commitments: draft.commitments.filter((other) => other.id !== commitment.id),
                });
              }}
            />
          ))}
        </View>
      )}
      {adding ? (
        <CommitmentForm
          onAdd={(commitment) => {
            update({ commitments: [...draft.commitments, commitment] });
            setAdding(false);
          }}
          onCancel={() => {
            setAdding(false);
          }}
        />
      ) : (
        <>
          <Button
            variant="outline"
            onPress={() => {
              setAdding(true);
            }}
          >
            {t.commitments.add}
          </Button>
          <Button
            onPress={() => {
              router.push("/onboarding/spent");
            }}
          >
            {draft.commitments.length > 0 ? t.next : t.skip}
          </Button>
          {draft.commitments.length === 0 && (
            <Text className="text-center font-sans text-sm text-muted-foreground">
              {t.commitments.later}
            </Text>
          )}
        </>
      )}
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
