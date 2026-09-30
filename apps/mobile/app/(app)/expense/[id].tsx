import { useMutation } from "@tanstack/react-query";
import {
  addDays,
  budgetPeriodAt,
  isoDate,
  parseMoneyInput,
  type IsoDate,
  type Transaction,
  type UpdateTransactionInput,
} from "@vireo/shared";
import { ApiError } from "@vireo/shared/api";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../../src/api";
import { useAccount } from "../../../src/auth/account";
import { apiErrorMessage } from "../../../src/auth/api-error-message";
import { Button } from "../../../src/components/button";
import { FormAlert } from "../../../src/components/form-alert";
import { LoadError, Skeleton } from "../../../src/components/query-states";
import { Screen } from "../../../src/components/screen";
import { TextField } from "../../../src/components/text-field";
import { useCategories } from "../../../src/dashboard/queries";
import { CategoryChip } from "../../../src/expenses/category-chip";
import { formatDayMonth } from "../../../src/format/date";
import { useExpenseTrashNotice } from "../../../src/history/notice";
import { refreshAfterExpenseChange, useExpense } from "../../../src/history/queries";
import { pl } from "../../../src/messages/pl";
import { amountError } from "../../../src/onboarding/draft";
import { toMoneyInput } from "../../../src/settings/forms";
import { useBudgetClock } from "../../../src/settings/queries";
import { BackButton } from "../../../src/settings/settings-screen-parts";

const t = pl.history;
const e = t.edit;

/** Every day of the period, first to last. */
function daysOf(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * The date as a day of a budget period, with ‹ › to earlier periods.
 * No calendar library: the usual fix is "it was yesterday", and the
 * period is the unit the whole app thinks in. Days after today are off.
 */
function DayPicker({
  anchor,
  value,
  today,
  periodStartDay,
  onChange,
}: {
  /** The expense's saved date: ‹ › move from its period, not from the day picked. */
  anchor: IsoDate;
  value: IsoDate;
  today: IsoDate;
  periodStartDay: number;
  onChange: (day: IsoDate) => void;
}) {
  const [offset, setOffset] = useState(0);
  const period = budgetPeriodAt(anchor, periodStartDay, offset);
  const reachesToday = period.end >= today;

  const arrow = (label: string, symbol: string, step: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        setOffset((current) => current + step);
      }}
      className={`h-11 w-11 items-center justify-center rounded-full border border-input ${disabled ? "opacity-40" : ""}`}
    >
      <Text className="font-sans-semibold text-lg text-foreground">{symbol}</Text>
    </Pressable>
  );

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        {arrow(t.previousPeriod, "‹", -1, false)}
        <Text className="flex-1 text-center font-sans text-sm text-muted-foreground">
          {t.periodRange(formatDayMonth(period.start), formatDayMonth(period.end))}
        </Text>
        {arrow(t.nextPeriod, "›", 1, reachesToday)}
      </View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={e.date}
        className="flex-row flex-wrap gap-[2.66%] gap-y-2"
      >
        {daysOf(period.start, period.end).map((day) => {
          const selected = day === value;
          const future = day > today;
          return (
            <Pressable
              key={day}
              accessibilityRole="radio"
              accessibilityLabel={formatDayMonth(day)}
              accessibilityState={{ selected, disabled: future }}
              disabled={future}
              onPress={() => {
                onChange(day);
              }}
              className={`aspect-square w-[12%] items-center justify-center rounded-xl border ${
                selected ? "border-primary bg-primary" : "border-input bg-background"
              } ${future ? "opacity-40" : ""}`}
            >
              <Text
                className={`font-sans-semibold text-sm ${
                  selected ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {Number(day.slice(8, 10))}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ExpenseForm({ expense }: { expense: Transaction }) {
  const account = useAccount();
  const today = useBudgetClock()().today;
  const categories = useCategories();
  const [, setNotice] = useExpenseTrashNotice();
  const [amount, setAmount] = useState(toMoneyInput(expense.amount));
  const [categoryId, setCategoryId] = useState(expense.categoryId);
  const [note, setNote] = useState(expense.note ?? "");
  const [date, setDate] = useState(isoDate(expense.date));
  const [amountErrorText, setAmountErrorText] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: (change: UpdateTransactionInput) => api.transactions.update(expense.id, change),
    onSuccess: () => {
      refreshAfterExpenseChange();
      router.back();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.transactions.remove(expense.id),
    onSuccess: () => {
      refreshAfterExpenseChange();
      const category = categories.data?.find((item) => item.id === expense.categoryId);
      setNotice({ kind: "deleted", expense, categoryName: category?.name ?? null });
      router.back();
    },
  });

  function submit() {
    const parsed = parseMoneyInput(amount);
    if (!parsed.ok) {
      setAmountErrorText(amountError(parsed.reason));
      return;
    }
    const change: UpdateTransactionInput = {};
    if (parsed.grosze !== expense.amount) change.amount = parsed.grosze;
    if (categoryId !== expense.categoryId) change.categoryId = categoryId;
    // An empty note is no note: stored as null, not as "".
    const trimmed = note.trim() === "" ? null : note.trim();
    if (trimmed !== expense.note) change.note = trimmed;
    if (date !== expense.date) change.date = date;
    if (Object.keys(change).length === 0) router.back();
    else save.mutate(change);
  }

  let categoryList: ReactNode;
  if (categories.isPending) {
    categoryList = <Skeleton label={pl.addExpense.loadingCategories} />;
  } else if (categories.isError) {
    categoryList = (
      <LoadError
        message={pl.addExpense.categoriesError}
        onRetry={() => void categories.refetch()}
      />
    );
  } else {
    categoryList = (
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={e.category}
        className="flex-row flex-wrap gap-2"
      >
        {categories.data.map((category) => (
          <CategoryChip
            key={category.id}
            category={category}
            selected={category.id === categoryId}
            onPress={() => {
              setCategoryId(category.id);
            }}
          />
        ))}
      </View>
    );
  }

  const failure = save.error ?? remove.error;
  return (
    <Screen title={e.title}>
      {failure && <FormAlert tone="error">{apiErrorMessage(failure, "settings")}</FormAlert>}
      <TextField
        label={e.amount}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setAmountErrorText(undefined);
        }}
        error={amountErrorText}
        keyboardType="decimal-pad"
      />
      <View className="gap-2">
        <Text className="font-sans-semibold text-sm text-foreground">{e.category}</Text>
        {categoryList}
      </View>
      <TextField label={e.note} value={note} onChangeText={setNote} />
      <View className="gap-2">
        <Text className="font-sans-semibold text-sm text-foreground">{e.date}</Text>
        <DayPicker
          anchor={isoDate(expense.date)}
          value={date}
          today={today}
          periodStartDay={account.periodStartDay}
          onChange={setDate}
        />
      </View>
      <Button loading={save.isPending} loadingLabel={pl.budgetSettings.saving} onPress={submit}>
        {pl.budgetSettings.save}
      </Button>
      <Button
        variant="destructive"
        loading={remove.isPending}
        loadingLabel={pl.budgetSettings.deleting}
        onPress={() => {
          remove.mutate();
        }}
      >
        {e.delete}
      </Button>
      <BackButton />
    </Screen>
  );
}

/** Editing one expense from the history: amount, category, note and date. */
export default function EditExpense() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpense(id);

  if (expense.data) return <ExpenseForm expense={expense.data} />;
  const missing =
    expense.error instanceof ApiError &&
    expense.error.kind === "http" &&
    expense.error.status === 404;
  return (
    <Screen title={e.title}>
      {expense.isPending ? (
        <Skeleton label={e.loading} lines={3} />
      ) : missing ? (
        <Text className="font-sans text-base text-foreground">{e.notFound}</Text>
      ) : (
        <LoadError message={e.error} onRetry={() => void expense.refetch()} />
      )}
      <BackButton />
    </Screen>
  );
}
