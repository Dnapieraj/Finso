import { router } from "expo-router";
import { Text } from "react-native";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { pl } from "../messages/pl";
import { useAccount } from "./account";

const t = pl.verifyEmail;

/**
 * Until the address is confirmed: a forgotten password can only be reset
 * with a code sent there, so a typo in it would lock the user out later.
 */
export function VerifyEmailCard() {
  const account = useAccount();
  if (account.emailVerified) return null;
  return (
    <Card title={t.title}>
      <Text className="font-sans text-base text-card-foreground">{t.card(account.email)}</Text>
      <Button
        variant="ghost"
        onPress={() => {
          router.push("/settings/verify-email");
        }}
      >
        {t.open}
      </Button>
    </Card>
  );
}
