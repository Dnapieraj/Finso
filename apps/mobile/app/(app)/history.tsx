import { useMutation } from "@tanstack/react-query";
import {
  budgetPeriodAt,
  formatMoney,
  grosze,
  type BudgetPeriod,
  type Category,
  type Transaction,
} from "@vireo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../src/api";
import { useAccount } from "../../src/auth/account";
import { Button } from "../../src/components/button";
import { LoadError, Skeleton } from "../../src/components/query-states";
import { Screen } from "../../src/components/screen";
import { useCategories } from "../../src/dashboard/queries";
import { CategoryChip } from "../../src/expenses/category-chip";
import { formatDayMonth } from "../../src/format/date";
import { CategoryChart } from "../../src/history/category-chart";
import { useExpenseTrashNotice, type ExpenseTrashNotice } from "../../src/history/notice";
import {
  refreshAfterExpenseChange,
  useHistory,
  useSpendingByCategory,
} from "../../src/history/queries";
import { pl } from "../../src/messages/pl";
import { useBudgetClock } from "../../src/settings/queries";
import { Pill } from "../../src/settings/schedule-fields";
import { BackButton } from "../../src/settings/settings-screen-parts";

const t = pl.history;

/** ‹ period › — never past the current period: there is no future to look at. */
function PeriodSwitcher({
  period,
  isCurrent,
  onMove,
}: {
  period: BudgetPeriod;
  isCurrent: boolean;
  onMove: (step: -1 | 1) => void;
}) {
  const arrow = (label: string, symbol: string, step: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        onMove(step);
      }}
      className={`h-11 w-11 items-center justify-center rounded-full border border-input ${disabled ? "opacity-40" : ""}`}
    >
      <Text className="font-sans-semibold text-lg text-foreground">{symbol}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row items-center justify-between gap-3">
      {arrow(t.previousPeriod, "‹", -1, false)}
      <Text
        accessibilityLabel={t.period}
        className="flex-1 text-center font-sans-semibold text-base text-foreground"
      >
        {t.periodRange(formatDayMonth(period.start), formatDayMonth(period.end))}
      </Text>
      {arrow(t.nextPeriod, "›", 1, isCurrent)}
    </View>
  );
}

function ExpenseRow({ expense, category }: { expense: Transaction; category?: Category }) {
  const title = category?.name ?? t.noCategory;
  const date = formatDayMonth(expense.date);
  // Exact grosze: this is a record of what was paid, not an estimate.
  const amount = formatMoney(grosze(expense.amount));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, date, amount, expense.note].filter(Boolean).join(", ")}
      onPress={() => {
        router.push(`/expense/${expense.id}`);
      }}
      className="flex-row items-center gap-3 py-2 active:opacity-70"
    >
      <View
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: category?.color ?? "transparent" }}
      />
      <View className="flex-1">
        <Text className="font-sans-semibold text-base text-card-foreground">{title}</Text>
        {expense.note && (
          <Text className="font-sans text-sm text-muted-foreground">{expense.note}</Text>
        )}
        <Text className="font-sans text-sm text-muted-foreground">{date}</Text>
      </View>
      <Text className="font-sans-semibold text-base text-card-foreground">{amount}</Text>
    </Pressable>
  );
}

/** "Usunięto wydatek" with Cofnij, or a failed Cofnij with a retry. */
function TrashNotice({ notice }: { notice: ExpenseTrashNotice }) {
  const [, setNotice] = useExpenseTrashNotice();
  const restore = useMutation({
    mutationFn: () => api.transactions.restore(notice.expense.id),
    onSuccess: () => {
      refreshAfterExpenseChange();
      setNotice(null);
    },
    onError: () => {
      setNotice({ ...notice, kind: "restore-failed" });
    },
  });
  const failed = notice.kind === "restore-failed";
  const amount = formatMoney(grosze(notice.expense.amount));

  return (
    <View
      className={`gap-2 rounded-2xl border bg-card p-4 ${failed ? "border-destructive" : "border-border"}`}
    >
      {/* Only the message is the alert: the buttons stay separate, reachable elements. */}
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text
          className={`font-sans text-base ${failed ? "text-destructive" : "text-card-foreground"}`}
        >
          {failed ? t.restoreFailed(amount) : t.deleted(amount, notice.categoryName)}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            variant="outline"
            loading={restore.isPending}
            onPress={() => {
              restore.mutate();
            }}
          >
            {failed ? pl.common.retry : t.undo}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            variant="ghost"
            onPress={() => {
              setNotice(null);
            }}
          >
            {t.close}
          </Button>
        </View>
      </View>
    </View>
  );
}

function Card({
  title,
  testID,
  children,
}: {
  title?: string;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <View testID={testID} className="gap-3 rounded-2xl bg-card p-4">
      {title && <Text className="font-heading text-lg text-card-foreground">{title}</Text>}
      {children}
    </View>
  );
}

/**
 * Past spending by budget period: a chart by category and the list of
 * expenses, filterable by category. Each expense opens for editing.
 */
export default function HistoryScreen() {
  const account = useAccount();
  const budgetClock = useBudgetClock();
  const [offset, setOffset] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notice] = useExpenseTrashNotice();

  const period = budgetPeriodAt(budgetClock().today, account.periodStartDay, offset);
  const categories = useCategories();
  const history = useHistory(period, categoryId);
  const spending = useSpendingByCategory(period);
  const byId = new Map((categories.data ?? []).map((category) => [category.id, category]));

  let chart: ReactNode;
  if (spending.isPending) {
    chart = <Skeleton label={t.chart.loading} lines={3} />;
  } else if (spending.isError) {
    chart = <LoadError message={t.chart.error} onRetry={() => void spending.refetch()} />;
  } else if (spending.data.byCategory.length === 0) {
    chart = <Text className="font-sans text-base text-muted-foreground">{t.empty}</Text>;
  } else {
    chart = (
      <CategoryChart
        summary={spending.data}
        categories={categories.data ?? []}
        onSelect={setCategoryId}
      />
    );
  }

  let list: ReactNode;
  if (history.isPending) {
    list = <Skeleton label={t.loading} lines={4} />;
  } else if (history.isError) {
    list = <LoadError message={t.error} onRetry={() => void history.refetch()} />;
  } else {
    const expenses = history.data.pages.flatMap((page) => page.items);
    list =
      expenses.length === 0 ? (
        <Text className="font-sans text-base text-muted-foreground">
          {categoryId ? t.emptyCategory : t.empty}
        </Text>
      ) : (
        <View>
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              category={expense.categoryId ? byId.get(expense.categoryId) : undefined}
            />
          ))}
          {history.hasNextPage && (
            <Button
              variant="outline"
              loading={history.isFetchingNextPage}
              loadingLabel={t.loadingMore}
              onPress={() => void history.fetchNextPage()}
            >
              {t.more}
            </Button>
          )}
        </View>
      );
  }

  return (
    <Screen title={t.title}>
      {notice && <TrashNotice notice={notice} />}
      <PeriodSwitcher
        period={period}
        isCurrent={offset >= 0}
        onMove={(step) => {
          setOffset((current) => Math.min(0, current + step));
        }}
      />
      <Card testID="category-chart" title={t.chart.title}>
        {chart}
      </Card>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.category}
        className="flex-row flex-wrap gap-2"
      >
        <Pill
          label={t.allCategories}
          selected={categoryId === null}
          onPress={() => {
            setCategoryId(null);
          }}
        />
        {(categories.data ?? []).map((category) => (
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
      <Card>{list}</Card>
      <BackButton />
    </Screen>
  );
}
