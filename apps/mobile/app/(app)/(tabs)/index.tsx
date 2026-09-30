import { formatMoney, grosze, type BudgetSummary, type Category, type Goal } from "@vireo/shared";
import { theme } from "@vireo/tokens";
import { useState, type ReactNode } from "react";
import { router } from "expo-router";
// Per-icon import: the package entry pulls in all ~1500 icons.
import Plus from "lucide-react-native/icons/plus";
import { Pressable, RefreshControl, Text, useColorScheme, View } from "react-native";

import { Button } from "../../../src/components/button";
import { ProgressBar } from "../../../src/components/progress-bar";
import { LoadError, Skeleton } from "../../../src/components/query-states";
import { Screen } from "../../../src/components/screen";
import { goalProgress } from "../../../src/dashboard/goal-progress";
import { periodProgress } from "../../../src/dashboard/period-progress";
import {
  useBudget,
  useCategories,
  useGoals,
  useRecentExpenses,
} from "../../../src/dashboard/queries";
import { ExpenseNoticeBar } from "../../../src/expenses/expense-notice";
import { formatDayMonth } from "../../../src/format/date";
import { plural } from "../../../src/format/plural";
import { pl } from "../../../src/messages/pl";

const t = pl.dashboard;
const GOALS_SHOWN = 3;

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl bg-card p-5">
      {title && (
        <Text accessibilityRole="header" className="font-heading text-xl text-card-foreground">
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

function BudgetOverview({ budget }: { budget: BudgetSummary }) {
  const progress = periodProgress(budget);
  const below = budget.availableBalance < 0;
  const dayCount = t.periodDay(progress.day, progress.totalDays);

  return (
    <Card>
      <View className="gap-1">
        <Text className="font-sans text-base text-muted-foreground">
          {below ? t.underTheLine : t.canSpend}
        </Text>
        {/* Rounded towards the user's safety: money left goes down, a debt goes up. */}
        <Text className={`font-heading text-5xl ${below ? "text-risk" : "text-card-foreground"}`}>
          {below
            ? formatMoney(grosze(-budget.availableBalance), { whole: "up" })
            : formatMoney(grosze(budget.availableBalance), { whole: "down" })}
        </Text>
      </View>
      {below ? (
        <Text className="font-sans text-base text-card-foreground">{t.noFreeMoney}</Text>
      ) : (
        <View className="gap-1">
          <Text className="font-sans-semibold text-lg text-card-foreground">
            {t.perDay(formatMoney(grosze(budget.dailyAllowance), { whole: "down" }))}
          </Text>
          {budget.daysRemaining > 0 && (
            <Text className="font-sans text-sm text-muted-foreground">
              {t.untilPayday(
                `${String(budget.daysRemaining)} ${plural(budget.daysRemaining, t.days)}`,
                formatDayMonth(progress.payday),
              )}
            </Text>
          )}
        </View>
      )}
      {budget.breakdown.periodIncome === 0 && (
        <Text className="font-sans text-sm text-muted-foreground">{t.noIncome}</Text>
      )}
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="font-sans text-sm text-muted-foreground">{t.period}</Text>
          <Text className="font-sans text-sm text-muted-foreground">{dayCount}</Text>
        </View>
        <ProgressBar
          label={t.period}
          now={progress.day}
          max={progress.totalDays}
          valueText={dayCount}
        />
      </View>
    </Card>
  );
}

function GoalRow({ goal, asOf }: { goal: Goal; asOf: string | null }) {
  const { percent, state } = goalProgress(goal, asOf);
  const percentText = `${String(percent)}%`;

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="shrink font-sans-semibold text-base text-card-foreground">
          {goal.name}
        </Text>
        <Text className="font-sans text-sm text-muted-foreground">{percentText}</Text>
      </View>
      <ProgressBar label={goal.name} now={percent} max={100} valueText={percentText} />
      <View className="flex-row justify-between gap-3">
        <Text className="font-sans text-sm text-muted-foreground">
          {t.goalSaved(
            formatMoney(grosze(goal.currentAmount), { whole: "down" }),
            formatMoney(grosze(goal.targetAmount), { whole: "up" }),
          )}
        </Text>
        {state === "reached" && (
          <Text className="font-sans-semibold text-sm text-safe">{t.goalReached}</Text>
        )}
        {state === "overdue" && (
          <Text className="font-sans-semibold text-sm text-caution">{t.goalOverdue}</Text>
        )}
      </View>
    </View>
  );
}

function Goals({ asOf }: { asOf: string | null }) {
  const goals = useGoals();

  let body: ReactNode;
  if (goals.isPending) {
    body = <Skeleton label={t.loadingGoals} />;
  } else if (goals.isError) {
    body = <LoadError message={t.goalsError} onRetry={() => void goals.refetch()} />;
  } else if (goals.data.length === 0) {
    body = <Text className="font-sans text-base text-muted-foreground">{t.noGoals}</Text>;
  } else {
    const hidden = goals.data.length - GOALS_SHOWN;
    body = (
      <>
        {goals.data.slice(0, GOALS_SHOWN).map((goal) => (
          <GoalRow key={goal.id} goal={goal} asOf={asOf} />
        ))}
        {hidden > 0 && (
          <Text className="font-sans text-sm text-muted-foreground">
            {`+${String(hidden)} ${plural(hidden, t.moreGoals)}`}
          </Text>
        )}
      </>
    );
  }
  return (
    <Card title={t.goals}>
      {body}
      <Button
        variant="ghost"
        onPress={() => {
          router.push("/goals");
        }}
      >
        {t.allGoals}
      </Button>
    </Card>
  );
}

function RecentExpenses() {
  const expenses = useRecentExpenses();
  const categories = useCategories();
  const byId = new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c]));

  let body: ReactNode;
  if (expenses.isPending) {
    body = <Skeleton label={t.loadingExpenses} lines={3} />;
  } else if (expenses.isError) {
    body = <LoadError message={t.expensesError} onRetry={() => void expenses.refetch()} />;
  } else if (expenses.data.items.length === 0) {
    body = <Text className="font-sans text-base text-muted-foreground">{t.noExpenses}</Text>;
  } else {
    body = expenses.data.items.map((expense) => {
      const category = expense.categoryId ? byId.get(expense.categoryId) : undefined;
      const title = category?.name ?? t.noCategory;
      const date = formatDayMonth(expense.date);
      // Exact grosze: this is a record of what was paid, not an estimate.
      const amount = formatMoney(grosze(expense.amount));
      return (
        <View
          key={expense.id}
          accessible
          accessibilityLabel={[title, date, amount, expense.note].filter(Boolean).join(", ")}
          className="flex-row items-center gap-3"
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
        </View>
      );
    });
  }
  return <Card title={t.expenses}>{body}</Card>;
}

/**
 * „Czy stać mnie na to teraz”: what is left until payday, per day, and
 * where the goals and recent spending stand. Each section loads and fails
 * on its own, so one broken request does not blank the whole screen.
 */
export default function DashboardScreen() {
  const budget = useBudget();
  const goals = useGoals();
  const expenses = useRecentExpenses();
  const [refreshing, setRefreshing] = useState(false);
  const colors = theme.colors[useColorScheme() === "dark" ? "dark" : "light"];

  async function refresh() {
    setRefreshing(true);
    await Promise.all([budget.refetch(), goals.refetch(), expenses.refetch()]);
    setRefreshing(false);
  }

  return (
    <View className="flex-1">
      <Screen
        title={t.title}
        testID="dashboard-scroll"
        floatingFooter
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {budget.isPending ? (
          <Card>
            <Skeleton label={t.loadingBudget} lines={3} />
          </Card>
        ) : budget.isError ? (
          <Card>
            <LoadError message={t.budgetError} onRetry={() => void budget.refetch()} />
          </Card>
        ) : (
          <BudgetOverview budget={budget.data} />
        )}
        <Goals asOf={budget.data?.asOf ?? null} />
        <RecentExpenses />
      </Screen>
      <View pointerEvents="box-none" className="absolute bottom-4 left-4 right-4 gap-3">
        <ExpenseNoticeBar />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pl.addExpense.open}
          onPress={() => {
            router.push("/add-expense");
          }}
          className="h-14 w-14 items-center justify-center self-end rounded-full bg-primary active:opacity-80"
        >
          <Plus color={colors.primaryForeground} size={28} />
        </Pressable>
      </View>
    </View>
  );
}
