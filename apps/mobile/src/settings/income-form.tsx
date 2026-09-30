import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import {
  parseMoneyInput,
  type CreateIncomeSourceRequest,
  type IncomeSource,
  type Schedule as SavedSchedule,
  type UpdateIncomeSourceInput,
} from "@vireo/shared";
import { ApiError } from "@vireo/shared/api";

import { api } from "../api";
import { apiErrorMessage } from "../auth/api-error-message";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { Screen } from "../components/screen";
import { TextField } from "../components/text-field";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { ChoiceCard } from "../onboarding/step";
import { toMoneyInput, useSettingsMutation, validateName } from "./forms";
import { INCOME_SOURCES_KEY, useBudgetClock } from "./queries";
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
  | { action: "create"; input: CreateIncomeSourceRequest }
  | { action: "update"; id: string; change: UpdateIncomeSourceInput };

interface Errors extends ScheduleErrors {
  name?: string;
  amount?: string;
}

/**
 * Adding (no `source`) or editing an income. A regular income has an
 * amount and a schedule, saved with the source in one request; an
 * irregular one only a name. The kind is chosen once: switching it would
 * change what the history of entries means.
 */
export function IncomeForm({ source }: { source?: IncomeSource }) {
  const [kind, setKind] = useState(source?.kind ?? "REGULAR");
  const [name, setName] = useState(source?.name ?? "");
  const [amount, setAmount] = useState(
    source?.expectedAmount == null ? "" : toMoneyInput(source.expectedAmount),
  );
  const [schedule, setSchedule] = useState<Schedule>(
    source?.schedule ? scheduleFieldsOf(source.schedule) : emptySchedule,
  );
  const [errors, setErrors] = useState<Errors>({});
  const budgetClock = useBudgetClock();

  const save = useSettingsMutation(INCOME_SOURCES_KEY, (request: Save) =>
    request.action === "create"
      ? api.incomeSources.create(request.input)
      : api.incomeSources.update(request.id, request.change),
  );

  const remove = useSettingsMutation(INCOME_SOURCES_KEY, async (id: string) => {
    try {
      await api.incomeSources.remove(id);
    } catch (error) {
      // A source with entries cannot be deleted — they are financial
      // history. Archived, it is gone from the list and the budget alike.
      if (!(error instanceof ApiError && error.kind === "http" && error.status === 409))
        throw error;
      await api.incomeSources.update(id, { isActive: false });
    }
  });

  function submit() {
    const found: Errors = {};
    const parsedName = validateName(name);
    if (!parsedName.ok) found.name = parsedName.message;

    // Only a regular income has an amount and a schedule. A `null`
    // schedule on edit means the saved one stays, start date included.
    let expectedAmount: number | null = null;
    let nextSchedule: SavedSchedule | null = null;
    if (kind === "REGULAR") {
      const parsedAmount = parseMoneyInput(amount);
      if (parsedAmount.ok) expectedAmount = parsedAmount.grosze;
      else found.amount = amountError(parsedAmount.reason);

      if (!isSameSchedule(schedule, source?.schedule ?? null)) {
        const checked = validateSchedule(schedule);
        if (checked.ok) {
          nextSchedule = toSchedule(schedule, checked.cadence, "INCOME", budgetClock());
        } else {
          Object.assign(found, checked.errors);
        }
      }
    }

    setErrors(found);
    if (!parsedName.ok || Object.keys(found).length > 0) return;

    if (!source) {
      save.mutate({
        action: "create",
        input: { name: parsedName.name, kind, expectedAmount, schedule: nextSchedule },
      });
      return;
    }

    const change: UpdateIncomeSourceInput = {};
    if (parsedName.name !== source.name) change.name = parsedName.name;
    if (kind === "REGULAR" && expectedAmount !== source.expectedAmount) {
      change.expectedAmount = expectedAmount;
    }
    if (nextSchedule) change.schedule = nextSchedule;
    if (Object.keys(change).length === 0) router.back();
    else save.mutate({ action: "update", id: source.id, change });
  }

  const failure = save.error ?? remove.error;
  return (
    <Screen title={source ? t.income.editTitle : t.income.newTitle}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      {!source && (
        <View accessibilityRole="radiogroup" accessibilityLabel={t.income.kind} className="gap-3">
          <ChoiceCard
            label={t.income.regular}
            hint={t.income.regularHint}
            selected={kind === "REGULAR"}
            onPress={() => {
              setKind("REGULAR");
            }}
          />
          <ChoiceCard
            label={t.income.irregular}
            hint={t.income.irregularHint}
            selected={kind === "IRREGULAR"}
            onPress={() => {
              setKind("IRREGULAR");
              setErrors({});
            }}
          />
        </View>
      )}
      <TextField
        label={t.name}
        value={name}
        onChangeText={(text) => {
          setName(text);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        error={errors.name}
      />
      {kind === "REGULAR" && (
        <>
          <TextField
            label={t.amount}
            hint={t.income.amountHint}
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
        </>
      )}
      <Button loading={save.isPending} loadingLabel={t.saving} onPress={submit}>
        {t.save}
      </Button>
      {source && (
        <DeleteWithConfirmation
          label={t.income.delete}
          warning={t.income.deleteWarning}
          pending={remove.isPending}
          onConfirm={() => {
            remove.mutate(source.id);
          }}
        />
      )}
      <BackButton />
    </Screen>
  );
}
