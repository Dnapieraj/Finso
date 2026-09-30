import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";

import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { useGoals } from "../../../../src/dashboard/queries";
import { GoalForm } from "../../../../src/goals/goal-form";
import { pl } from "../../../../src/messages/pl";
import { BackButton } from "../../../../src/settings/settings-screen-parts";

const t = pl.goals;

/** Editing one goal, found in the list the previous screen already loaded. */
export default function EditGoal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const goal = goals.data?.find((item) => item.id === id);

  if (goal) return <GoalForm goal={goal} />;
  return (
    <Screen title={t.editTitle}>
      {goals.isPending ? (
        <Skeleton label={t.loading} lines={3} />
      ) : goals.isError ? (
        <LoadError message={t.error} onRetry={() => void goals.refetch()} />
      ) : (
        <Text className="font-sans text-base text-foreground">{t.notFound}</Text>
      )}
      <BackButton />
    </Screen>
  );
}
