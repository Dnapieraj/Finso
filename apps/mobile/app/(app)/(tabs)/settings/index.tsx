import { router } from "expo-router";
import { Text, View } from "react-native";

import { useLogout, useMe } from "../../../src/auth/hooks";
import { Button } from "../../../src/components/button";
import { Screen } from "../../../src/components/screen";
import { pl } from "../../../src/messages/pl";

const t = pl.settings;

function AccountEmail() {
  const me = useMe();

  if (me.isPending) {
    return (
      <View
        accessible
        accessibilityLabel={t.loadingAccount}
        className="h-6 w-48 rounded-md bg-muted"
      />
    );
  }
  if (me.isError) {
    return (
      <View className="gap-3">
        <Text className="font-sans text-base text-destructive">{t.accountError}</Text>
        <Button variant="outline" onPress={() => void me.refetch()}>
          {pl.common.retry}
        </Button>
      </View>
    );
  }
  return <Text className="font-sans text-base text-foreground">{me.data.email}</Text>;
}

export default function SettingsScreen() {
  const logout = useLogout();

  return (
    <Screen title={t.title}>
      <View className="gap-2 rounded-2xl bg-card p-4">
        <Text className="font-sans-semibold text-sm text-muted-foreground">{t.account}</Text>
        <AccountEmail />
      </View>
      <Button
        variant="outline"
        loading={logout.isPending}
        loadingLabel={t.loggingOut}
        onPress={() => {
          logout.mutate();
        }}
      >
        {t.logout}
      </Button>
      <Button
        variant="destructive"
        onPress={() => {
          router.push("/settings/delete-account");
        }}
      >
        {t.deleteAccount}
      </Button>
    </Screen>
  );
}
