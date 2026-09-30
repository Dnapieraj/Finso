import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import {
  parseMoneyInput,
  type CreateGoalRequest,
  type Goal,
  type IdempotentDraft,
  type UpdateGoalInput,
} from "@vireo/shared";

import { api } from "../api";
import { apiErrorMessage } from "../auth/api-error-message";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { Screen } from "../components/screen";
import { TextField } from "../components/text-field";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { FieldError } from "../onboarding/step";
import { toMoneyInput, useDraft, useSettingsMutation, validateName } from "../settings/forms";
import { refreshBudget, useBudgetClock } from "../settings/queries";
import { Pill } from "../settings/schedule-fields";
import { BackButton } from "../settings/settings-screen-parts";
import { queryClient } from "../query-client";
import { isBeforeMonth, lastDayOf, monthOf } from "./deadline";
import { useGoalNotice } from "./notice";

const t = pl.goals;

export const GOALS_KEY = ["goals"] as const;

interface Errors {
  name?: string;
  target?: string;
  saved?: string;
  month?: string;
}

type Save =
  | { action: "create"; draft: IdempotentDraft<CreateGoalRequest> }
  | { action: "update"; id: string; change: UpdateGoalInput };

/** "Już odłożone": empty and 0 both mean nothing saved yet. */
function parseSaved(text: string): { ok: true; grosze: number } | { ok: false; message: string } {
  if (text.trim() === "") return { ok: true, grosze: 0 };
  const parsed = parseMoneyInput(text);
  if (parsed.ok) return { ok: true, grosze: parsed.grosze };
  return parsed.reason === "zero"
    ? { ok: true, grosze: 0 }
    : { ok: false, message: amountError(parsed.reason) };
}

function YearStepper({
  year,
  min,
  onChange,
}: {
  year: number;
  min: number;
  onChange: (year: number) => void;
}) {
  const step = (label: string, symbol: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onChange(next);
      }}
      className={`h-11 w-11 items-center justify-center rounded-full border border-input ${disabled ? "opacity-40" : ""}`}
    >
      <Text className="font-sans-semibold text-lg text-foreground">{symbol}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-4">
      {step(t.previousYear, "‹", year - 1, year <= min)}
      <Text accessibilityLabel={t.year} className="font-sans-semibold text-lg text-foreground">
        {year}
      </Text>
      {step(t.nextYear, "›", year + 1, false)}
    </View>
  );
}

/**
 * Adding (no `goal`) or editing a savings goal. The deadline is a month
 * and a year; the goal is due on the month's last day. Edits send only
 * what changed, so an overdue goal keeps its past deadline untouched.
 */
export function GoalForm({ goal }: { goal?: Goal }) {
  const budgetClock = useBudgetClock();
  const today = monthOf(budgetClock().today);
  const saved = goal ? monthOf(goal.targetDate) : null;

  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal ? toMoneyInput(goal.targetAmount) : "");
  const [already, setAlready] = useState(goal ? toMoneyInput(goal.currentAmount) : "");
  const [month, setMonth] = useState<number | null>(saved?.month ?? null);
  const [year, setYear] = useState(saved?.year ?? today.year);
  const [errors, setErrors] = useState<Errors>({});
  const [, setNotice] = useGoalNotice();
  const draft = useDraft((input: CreateGoalRequest) => api.goals.draft(input));

  const save = useSettingsMutation(GOALS_KEY, (request: Save) =>
    request.action === "create"
      ? api.goals.create(request.draft)
      : api.goals.update(request.id, request.change),
  );
  const remove = useMutation({
    mutationFn: (toTrash: Goal) => api.goals.remove(toTrash.id),
    onSuccess: (_result, toTrash) => {
      void queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      void refreshBudget();
      setNotice({ kind: "deleted", goal: toTrash });
      router.back();
    },
  });

  function clearError(field: keyof Errors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit() {
    const found: Errors = {};
    const parsedName = validateName(name);
    if (!parsedName.ok) found.name = parsedName.message;
    const parsedTarget = parseMoneyInput(target);
    if (!parsedTarget.ok) found.target = amountError(parsedTarget.reason);
    const parsedSaved = parseSaved(already);
    if (!parsedSaved.ok) found.saved = parsedSaved.message;

    const chosen = month === null ? null : { year, month };
    const deadlineChanged =
      chosen !== null && (chosen.year !== saved?.year || chosen.month !== saved.month);
    if (chosen === null) found.month = t.monthRequired;
    else if (deadlineChanged && isBeforeMonth(chosen, today)) found.month = t.pastDeadline;

    setErrors(found);
    if (!parsedName.ok || !parsedTarget.ok || !parsedSaved.ok || chosen === null) return;
    if (Object.keys(found).length > 0) return;

    if (!goal) {
      save.mutate({
        action: "create",
        draft: draft({
          name: parsedName.name,
          targetAmount: parsedTarget.grosze,
          currentAmount: parsedSaved.grosze,
          targetDate: lastDayOf(chosen),
        }),
      });
      return;
    }

    const change: UpdateGoalInput = {};
    if (parsedName.name !== goal.name) change.name = parsedName.name;
    if (parsedTarget.grosze !== goal.targetAmount) change.targetAmount = parsedTarget.grosze;
    if (parsedSaved.grosze !== goal.currentAmount) change.currentAmount = parsedSaved.grosze;
    if (deadlineChanged) change.targetDate = lastDayOf(chosen);
    if (Object.keys(change).length === 0) router.back();
    else save.mutate({ action: "update", id: goal.id, change });
  }

  const failure = save.error ?? remove.error;
  return (
    <Screen title={goal ? t.editTitle : t.newTitle}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      <TextField
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          clearError("name");
        }}
        error={errors.name}
      />
      <TextField
        label={t.target}
        value={target}
        onChangeText={(text) => {
          setTarget(text);
          clearError("target");
        }}
        error={errors.target}
        keyboardType="decimal-pad"
      />
      <TextField
        label={t.saved}
        hint={t.savedHint}
        value={already}
        onChangeText={(text) => {
          setAlready(text);
          clearError("saved");
        }}
        error={errors.saved}
        keyboardType="decimal-pad"
      />
      <View className="gap-3">
        <Text className="font-sans-semibold text-sm text-foreground">{t.deadline}</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t.month}
          className="flex-row flex-wrap gap-2"
        >
          {t.months.map((label, index) => (
            <Pill
              key={label}
              label={label}
              text={label.slice(0, 3)}
              selected={month === index}
              onPress={() => {
                setMonth(index);
                clearError("month");
              }}
            />
          ))}
        </View>
        <YearStepper
          year={year}
          // An overdue goal may keep its past year; a new deadline may not go back.
          min={Math.min(today.year, saved?.year ?? today.year)}
          onChange={(next) => {
            setYear(next);
            clearError("month");
          }}
        />
        <FieldError>{errors.month}</FieldError>
      </View>
      <Button loading={save.isPending} loadingLabel={pl.budgetSettings.saving} onPress={submit}>
        {pl.budgetSettings.save}
      </Button>
      {goal && (
        <Button
          variant="destructive"
          loading={remove.isPending}
          loadingLabel={pl.budgetSettings.deleting}
          onPress={() => {
            remove.mutate(goal);
          }}
        >
          {t.delete}
        </Button>
      )}
      <BackButton />
    </Screen>
  );
}
