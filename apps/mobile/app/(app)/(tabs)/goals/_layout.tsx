import { Stack } from "expo-router";

import { GoalNoticeProvider } from "../../../../src/goals/notice";

/** A link straight to a goal still has the list under it, for "Wstecz". */
export const unstable_settings = { initialRouteName: "index" };

export default function GoalsLayout() {
  return (
    <GoalNoticeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </GoalNoticeProvider>
  );
}
