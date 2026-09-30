import { useMutation } from "@tanstack/react-query";
import { formatMoney, grosze, type Goal } from "@vireo/shared";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../../../src/api";
import { Button } from "../../../../src/components/button";
import { ProgressBar } from "../../../../src/components/progress-bar";
import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { goalProgress } from "../../../../src/dashboard/goal-progress";
import { useBudget, useGoals } from "../../../../src/dashboard/queries";
import { monthOf } from "../../../../src/goals/deadline";
import { GOALS_KEY } from "../../../../src/goals/goal-form";
import { useGoalNotice, type GoalNotice } from "../../../../src/goals/notice";
import { pl } from "../../../../src/messages/pl";
import { queryClient } from "../../../../src/query-client";
import { refreshBudget } from "../../../../src/settings/queries";

const t = pl.goals;

function GoalRow({
  goal,
  asOf,
  instalment,
}: {
  goal: Goal;
  asOf: string | null;
  /** What the budget sets aside for this goal this period; `null` until it loads. */
  instalment: number | null;
}) {
  const { percent, state } = goalProgress(goal, asOf);
  const deadline = monthOf(goal.targetDate);

  let status: ReactNode = null;
  if (state === "reached") {
    status = <Text className="font-sans-semibold text-sm text-safe">{t.reached}</Text>;
  } else if (state === "overdue") {
    status = <Text className="font-sans-semibold text-sm text-caution">{t.overdue}</Text>;
  } else if (instalment !== null && instalment > 0) {
    status = (
      <Text className="font-sans-semibold text-sm text-foreground">
        {/* Saving rounds up: a rounded-down instalment would never close the goal. */}
        {t.instalment(formatMoney(grosze(instalment), { whole: "up" }))}
      </Text>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={goal.name}
      onPress={() => {
        router.push(`/goals/${goal.id}`);
      }}
      className="gap-2 rounded-2xl bg-card p-4 active:opacity-80"
    >
      <Text className="font-sans-semibold text-base text-card-foreground">{goal.name}</Text>
      <ProgressBar label={goal.name} now={percent} max={100} valueText={`${String(percent)}%`} />
      <Text className="font-sans text-sm text-muted-foreground">
        {t.savedOf(
          formatMoney(grosze(goal.currentAmount), { whole: "down" }),
          formatMoney(grosze(goal.targetAmount), { whole: "up" }),
        )}
      </Text>
      <Text className="font-sans text-sm text-muted-foreground">
        {t.until(deadline.month, deadline.year)}
      </Text>
      {status}
    </Pressable>
  );
}

/** "Usunięto cel" with Cofnij, or a failed Cofnij with a retry. */
function TrashNotice({ notice }: { notice: GoalNotice }) {
  const [, setNotice] = useGoalNotice();
  const restore = useMutation({
    mutationFn: () => api.goals.restore(notice.goal.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GOALS_KEY });
      void refreshBudget();
      setNotice(null);
    },
    onError: () => {
      setNotice({ kind: "restore-failed", goal: notice.goal });
    },
  });
  const failed = notice.kind === "restore-failed";

  return (
    <View
      className={`gap-2 rounded-2xl border bg-card p-4 ${failed ? "border-destructive" : "border-border"}`}
    >
      {/* Only the message is the alert: the buttons stay separate, reachable elements. */}
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text
          className={`font-sans text-base ${failed ? "text-destructive" : "text-card-foreground"}`}
        >
          {failed ? t.restoreFailed(notice.goal.name) : t.deleted(notice.goal.name)}
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

/** Savings goals: how far each is, by when, and what the budget sets aside for it. */
export default function GoalList() {
  const goals = useGoals();
  const budget = useBudget();
  const [notice] = useGoalNotice();
  const instalmentOf = (id: string) =>
    budget.data
      ? (budget.data.goalContributions.find((line) => line.goalId === id)?.amount ?? 0)
      : null;

  let list: ReactNode;
  if (goals.isPending) {
    list = <Skeleton label={t.loading} lines={3} />;
  } else if (goals.isError) {
    list = <LoadError message={t.error} onRetry={() => void goals.refetch()} />;
  } else if (goals.data.length === 0) {
    list = <Text className="font-sans text-base text-muted-foreground">{t.empty}</Text>;
  } else {
    list = (
      <View className="gap-3">
        {goals.data.map((goal) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            asOf={budget.data?.asOf ?? null}
            instalment={instalmentOf(goal.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <Screen title={t.title}>
      {notice && <TrashNotice notice={notice} />}
      {list}
      <Button
        variant="outline"
        onPress={() => {
          router.push("/goals/new");
        }}
      >
        {t.add}
      </Button>
    </Screen>
  );
}
