import { router } from "expo-router";
import { Text } from "react-native";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { useCategories } from "../dashboard/queries";
import { pl } from "../messages/pl";
import { useSubscriptions } from "./queries";

const t = pl.subscriptions;

/**
 * A nudge on the dashboard while the detector has something to review.
 * "New" = not yet confirmed or dismissed: both decisions take an item off
 * the list, so the card goes away on its own. Loading and errors show
 * nothing — the dashboard's own numbers do not depend on this.
 */
export function SubscriptionsCard() {
  const subscriptions = useSubscriptions();
  const categories = useCategories();
  const detected = subscriptions.data?.detected ?? [];
  if (detected.length === 0) return null;

  const names = detected.map(
    (item) =>
      item.name ??
      categories.data?.find((category) => category.id === item.categoryId)?.name ??
      pl.history.noCategory,
  );
  return (
    <Card title={t.card.title}>
      <Text className="font-sans text-base text-card-foreground">
        {t.card.body(names.join(", "))}
      </Text>
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
