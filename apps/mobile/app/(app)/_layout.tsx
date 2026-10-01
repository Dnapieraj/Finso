import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountProvider } from "../../src/auth/account";
import { useMe } from "../../src/auth/hooks";
import { LoadError, Skeleton } from "../../src/components/query-states";
import { ExpenseTrashNoticeProvider } from "../../src/history/notice";
import { pl } from "../../src/messages/pl";

/**
 * The signed-in app. Until onboarding is finished only onboarding is
 * reachable; afterwards it is gone from history, so Back never returns to
 * it. The tabs sit in a group, so the URLs stay "/" and "/settings", with
 * the quick add presented over them as a modal.
 *
 * The account decides which, so it loads first — once per launch; after
 * login or registration it is already cached.
 */
/**
 * A link straight to a screen of this stack (e.g. /history from a
 * notification) still has the tabs under it, so "Wstecz" lands on the
 * dashboard instead of closing the app.
 */
export const unstable_settings = { initialRouteName: "(tabs)" };

export default function AppLayout() {
  const me = useMe();

  if (me.isPending || me.isError) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center px-6">
          {me.isPending ? (
            <Skeleton label={pl.account.loading} lines={3} />
          ) : (
            <LoadError message={pl.account.error} onRetry={() => void me.refetch()} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const onboarded = me.data.onboardingCompleted;
  return (
    <AccountProvider value={me.data}>
      <ExpenseTrashNoticeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
            <Stack.Screen name="history" />
            <Stack.Screen name="expense/[id]" />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
        </Stack>
      </ExpenseTrashNoticeProvider>
    </AccountProvider>
  );
}
