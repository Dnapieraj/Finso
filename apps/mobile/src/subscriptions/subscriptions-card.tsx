import { router } from "expo-router";
import { Text } from "react-native";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { useCategories } from "../dashboard/queries";
import { pl } from "../messages/pl";
import { useSubscriptions } from "./queries";

const t = pl.subscriptions;

/**
 * A nudge on the dashboard while the detector has something to review, or a
 * confirmed subscription has been paid for months without „Używam”. Each
 * decision takes an item off, so the card goes away on its own. Loading and
 * errors show nothing — the dashboard's own numbers do not depend on this.
 */
export function SubscriptionsCard() {
  const subscriptions = useSubscriptions();
  const categories = useCategories();
  const detected = subscriptions.data?.detected ?? [];
  const unused = (subscriptions.data?.confirmed ?? []).filter((item) => item.askIfUsed);
  if (detected.length === 0 && unused.length === 0) return null;

  const names = detected.map(
    (item) =>
      item.name ??
      categories.data?.find((category) => category.id === item.categoryId)?.name ??
      pl.history.noCategory,
  );
  return (
    <Card title={detected.length > 0 ? t.card.title : t.unused.title}>
      {detected.length > 0 && (
        <Text className="font-sans text-base text-card-foreground">
          {t.card.body(names.join(", "))}
        </Text>
      )}
      {unused.length > 0 && (
        <Text className="font-sans text-base text-card-foreground">
          {t.unused.card(unused.map((item) => item.name).join(", "))}
        </Text>
      )}
      <Button
        variant="ghost"
        accessibilityLabel={t.card.openLabel}
        onPress={() => {
          router.push("/settings/subscriptions");
        }}
      >
        {t.card.open}
      </Button>
    </Card>
  );
}
