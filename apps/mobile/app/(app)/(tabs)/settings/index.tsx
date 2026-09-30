import { router, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useAccount } from "../../../../src/auth/account";
import { useLogout } from "../../../../src/auth/hooks";
import { Button } from "../../../../src/components/button";
import { Screen } from "../../../../src/components/screen";
import { pl } from "../../../../src/messages/pl";

const t = pl.settings;

/** A row that opens a settings screen; `value` shows the current setting. */
function SettingsLink({ label, value, href }: { label: string; value?: string; href: Href }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={value}
      onPress={() => {
        router.push(href);
      }}
      className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-3 active:opacity-70"
    >
      <Text className="font-sans-semibold text-base text-card-foreground">{label}</Text>
      <Text className="font-sans text-sm text-muted-foreground">{value ?? "›"}</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const logout = useLogout();
  const account = useAccount();

  return (
    <Screen title={t.title}>
      <View className="gap-2 rounded-2xl bg-card p-4">
        <Text className="font-sans-semibold text-sm text-muted-foreground">{t.account}</Text>
        <Text className="font-sans text-base text-foreground">{account.email}</Text>
      </View>
      <View className="gap-2">
        <Text className="font-sans-semibold text-sm text-muted-foreground">{t.budget}</Text>
        <View className="divide-y divide-border rounded-2xl bg-card">
          <SettingsLink
            label={t.payday}
            value={t.paydayValue(account.periodStartDay)}
            href="/settings/payday"
          />
          <SettingsLink label={t.incomes} href="/settings/income" />
          <SettingsLink label={t.commitments} href="/settings/commitments" />
        </View>
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
