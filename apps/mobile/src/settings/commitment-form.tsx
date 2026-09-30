import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import {
  parseMoneyInput,
  type CreateRecurringRuleRequest,
  type RecurringRule,
  type Schedule as SavedSchedule,
  type UpdateRecurringRuleInput,
} from "@vireo/shared";

import { api } from "../api";
import { apiErrorMessage } from "../auth/api-error-message";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { LoadError, Skeleton } from "../components/query-states";
import { Screen } from "../components/screen";
import { TextField } from "../components/text-field";
import { useCategories } from "../dashboard/queries";
import { CategoryChip } from "../expenses/category-chip";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { FieldError } from "../onboarding/step";
import { toMoneyInput, useSettingsMutation, validateName } from "./forms";
import { RECURRING_RULES_KEY, useBudgetClock } from "./queries";
import {
  emptySchedule,
  isSameSchedule,
  scheduleFieldsOf,
  toSchedule,
  validateSchedule,
  type ScheduleErrors,
  type ScheduleFields as Schedule,
} from "./schedule";
import { ScheduleFields } from "./schedule-fields";
import { BackButton, DeleteWithConfirmation } from "./settings-screen-parts";

const t = pl.budgetSettings;

type Save =
  | { action: "create"; input: CreateRecurringRuleRequest }
  | { action: "update"; id: string; change: UpdateRecurringRuleInput };

interface Errors extends ScheduleErrors {
  name?: string;
  amount?: string;
  category?: string;
}

function CategoryPicker({
  value,
  error,
  onChange,
}: {
  value: string | null;
  error?: string;
  onChange: (categoryId: string) => void;
}) {
  const categories = useCategories();

  let list: ReactNode;
  if (categories.isPending) {
    list = <Skeleton label={t.commitments.loadingCategories} />;
  } else if (categories.isError) {
    list = (
      <LoadError
        message={t.commitments.categoriesError}
        onRetry={() => void categories.refetch()}
      />
    );
  } else {
    list = (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.commitments.category}
        className="flex-row flex-wrap gap-2"
      >
        {categories.data.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            selected={category.id === value}
            onPress={() => {
              onChange(category.id);
            }}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-sm text-foreground">{t.commitments.category}</Text>
      {list}
      <FieldError>{error}</FieldError>
    </View>
  );
}

/**
 * Adding (no `rule`) or editing a fixed commitment — a monthly or weekly
 * expense rule. Only what changed is sent, so an unchanged schedule keeps
 * its start date.
 */
export function CommitmentForm({ rule }: { rule?: RecurringRule }) {
  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(
    rule?.expectedAmount == null ? "" : toMoneyInput(rule.expectedAmount),
  );
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? null);
  const [schedule, setSchedule] = useState<Schedule>(rule ? scheduleFieldsOf(rule) : emptySchedule);
  const [errors, setErrors] = useState<Errors>({});
  const budgetClock = useBudgetClock();

  const save = useSettingsMutation(RECURRING_RULES_KEY, (request: Save) =>
    request.action === "create"
      ? api.recurringRules.create(request.input)
      : api.recurringRules.update(request.id, request.change),
  );
  const remove = useSettingsMutation(RECURRING_RULES_KEY, (id: string) =>
    api.recurringRules.remove(id),
  );

  function submit() {
    const found: Errors = {};
    const parsedName = validateName(name);
    if (!parsedName.ok) found.name = parsedName.message;
    const parsedAmount = parseMoneyInput(amount);
    if (!parsedAmount.ok) found.amount = amountError(parsedAmount.reason);
    if (categoryId === null) found.category = t.commitments.categoryRequired;

    // null = the saved schedule stays, start date included.
    let nextSchedule: SavedSchedule | null = null;
    if (!isSameSchedule(schedule, rule ?? null)) {
      const checked = validateSchedule(schedule);
      if (checked.ok) {
        nextSchedule = toSchedule(schedule, checked.cadence, "EXPENSE", budgetClock());
      } else {
        Object.assign(found, checked.errors);
      }
    }

    setErrors(found);
    if (!parsedName.ok || !parsedAmount.ok || categoryId === null) return;
    if (Object.keys(found).length > 0) return;

    if (!rule) {
      if (!nextSchedule) return;
      save.mutate({
        action: "create",
        input: {
          kind: "EXPENSE",
          name: parsedName.name,
          ...nextSchedule,
          expectedAmount: parsedAmount.grosze,
          categoryId,
        },
      });
      return;
    }

    const change: UpdateRecurringRuleInput = { ...nextSchedule };
    if (parsedName.name !== rule.name) change.name = parsedName.name;
    if (parsedAmount.grosze !== rule.expectedAmount) change.expectedAmount = parsedAmount.grosze;
    if (categoryId !== rule.categoryId) change.categoryId = categoryId;
    if (Object.keys(change).length === 0) router.back();
    else save.mutate({ action: "update", id: rule.id, change });
  }

  const failure = save.error ?? remove.error;
  return (
    <Screen title={rule ? t.commitments.editTitle : t.commitments.newTitle}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      <TextField
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        error={errors.name}
      />
      <TextField
        label={t.amount}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setErrors((current) => ({ ...current, amount: undefined }));
        }}
        error={errors.amount}
        keyboardType="decimal-pad"
      />
      <ScheduleFields
        value={schedule}
        errors={errors}
        onChange={(change) => {
          setSchedule((current) => ({ ...current, ...change }));
          setErrors((current) => ({
            ...current,
            dayOfMonth: undefined,
            dayOfWeek: undefined,
            week: undefined,
          }));
        }}
      />
      <CategoryPicker
        value={categoryId}
        error={errors.category}
        onChange={(id) => {
          setCategoryId(id);
          setErrors((current) => ({ ...current, category: undefined }));
        }}
      />
      <Button loading={save.isPending} loadingLabel={t.saving} onPress={submit}>
        {t.save}
      </Button>
      {rule && (
        <DeleteWithConfirmation
          label={t.commitments.delete}
          warning={t.commitments.deleteWarning}
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(rule.id);
          }}
        />
      )}
      <BackButton />
    </Screen>
  );
}
