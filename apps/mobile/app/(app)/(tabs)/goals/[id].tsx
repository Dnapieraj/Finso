import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { useGoals } from "../../../../src/dashboard/queries";
import { GoalDeposits } from "../../../../src/goals/goal-deposits";
import { GoalForm } from "../../../../src/goals/goal-form";
import { pl } from "../../../../src/messages/pl";

const t = pl.goals;

/** One goal: deposits first, then its settings — found in the list already loaded. */
export default function EditGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const goal = goals.data?.find((item) => item.id === id);

  if (goal) {
    return (
      <GoalForm goal={goal}>
        <GoalDeposits goal={goal} />
      </GoalForm>
    );
  }
  return (
    <Screen back title={t.editTitle}>
      {goals.isPending ? (
        <Skeleton label={t.loading} lines={3} />
      ) : goals.isError ? (
        <LoadError message={t.error} onRetry={() => void goals.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.notFound}</Text>
      )}
    </Screen>
  );
}
