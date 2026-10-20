import { useMutation } from "@tanstack/react-query";
import {
  grosze,
  type ConfirmSubscriptionInput,
  type ConfirmedSubscriptionOutput,
  type DetectedSubscriptionOutput,
  type PriceChangeOutput,
} from "@vireo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { api } from "../../../../src/api";
import { Button } from "../../../../src/components/button";
import { Card } from "../../../../src/components/card";
import { FormAlert } from "../../../../src/components/form-alert";
import { LoadError, Skeleton } from "../../../../src/components/query-states";
import { Screen } from "../../../../src/components/screen";
import { CONFIRMATIONS_KEY } from "../../../../src/confirmations/queries";
import { useCategories } from "../../../../src/dashboard/queries";
import { haptics } from "../../../../src/feedback/haptics";
import { formatDayMonth } from "../../../../src/format/date";
import { plural } from "../../../../src/format/plural";
import { pl } from "../../../../src/messages/pl";
import { useMoney, type Money } from "../../../../src/privacy/money";
import { queryClient } from "../../../../src/query-client";
import { useDraft } from "../../../../src/settings/forms";
import { RECURRING_RULES_KEY, refreshBudget } from "../../../../src/settings/queries";
import { BackButton, ListRow } from "../../../../src/settings/settings-screen-parts";
import { SUBSCRIPTIONS_KEY, useSubscriptions } from "../../../../src/subscriptions/queries";

const t = pl.subscriptions;

type Frequency = DetectedSubscriptionOutput["frequency"];

/** "co miesiąc", "co 2 tygodnie". */
function frequencyText(frequency: Frequency, interval = 1): string {
  return interval === 1
    ? t.frequency[frequency]
    : t.every(interval, plural(interval, t.units[frequency]));
}

/** "23 zł/mies. · 276 zł/rok" — costs round up, never promising more money left. */
function costText(money: Money, item: { monthly: number; yearly: number }): string {
  return t.cost(
    money.format(grosze(item.monthly), { whole: "up" }),
    money.format(grosze(item.yearly), { whole: "up" }),
  );
}

/** Exact prices: they are what was actually paid. */
function priceChangeText(money: Money, change: PriceChangeOutput): string {
  const describe = change.yearlyDelta >= 0 ? t.priceUp : t.priceDown;
  return describe(
    money.format(grosze(change.from)),
    money.format(grosze(change.to)),
    formatDayMonth(change.since),
    money.format(grosze(Math.abs(change.yearlyDelta))),
  );
}

type Notice =
  | { kind: "confirmed"; text: string }
  | { kind: "dismissed"; text: string; key: string }
  | { kind: "error" };

function refreshAfterDecision() {
  void queryClient.invalidateQueries({ queryKey: SUBSCRIPTIONS_KEY });
}

/**
 * What the user pays for regularly: confirmed subscriptions (commitments
 * marked as such) with their sum, and repeating expenses the detector
 * found, each to confirm („To subskrypcja” → a commitment) or dismiss.
 */
export default function SubscriptionsScreen() {
  const subscriptions = useSubscriptions();
  const categories = useCategories();
  const money = useMoney();
  const [notice, setNotice] = useState<Notice | null>(null);
  const draft = useDraft((input: ConfirmSubscriptionInput) =>
    api.subscriptions.draftConfirm(input),
  );

  const nameOf = (item: DetectedSubscriptionOutput) =>
    item.name ??
    categories.data?.find((category) => category.id === item.categoryId)?.name ??
    pl.history.noCategory;

  const confirm = useMutation({
    mutationFn: (item: DetectedSubscriptionOutput) =>
      api.subscriptions.confirm(draft({ key: item.key, name: nameOf(item) })),
    onSuccess: (rule, item) => {
      haptics.saved();
      setNotice({
        kind: "confirmed",
        text: t.confirmed(nameOf(item), formatDayMonth(rule.startDate)),
      });
      refreshAfterDecision();
      void queryClient.invalidateQueries({ queryKey: RECURRING_RULES_KEY });
      void queryClient.invalidateQueries({ queryKey: CONFIRMATIONS_KEY });
      void refreshBudget();
    },
    onError: () => {
      haptics.failed();
      setNotice({ kind: "error" });
    },
  });

  const dismiss = useMutation({
    mutationFn: (item: DetectedSubscriptionOutput) => api.subscriptions.dismiss(item.key),
    onSuccess: (_result, item) => {
      setNotice({ kind: "dismissed", text: t.dismissed(nameOf(item)), key: item.key });
      refreshAfterDecision();
    },
    onError: () => {
      haptics.failed();
      setNotice({ kind: "error" });
    },
  });

  const undo = useMutation({
    mutationFn: (key: string) => api.subscriptions.undismiss(key),
    onSuccess: () => {
      setNotice(null);
      refreshAfterDecision();
    },
    onError: () => {
      haptics.failed();
      setNotice({ kind: "error" });
    },
  });

  let body: ReactNode;
  if (subscriptions.isPending) {
    body = <Skeleton label={t.loading} lines={4} />;
  } else if (subscriptions.isError) {
    body = <LoadError message={t.error} onRetry={() => void subscriptions.refetch()} />;
  } else {
    const { confirmed, detected, totals } = subscriptions.data;
    body = (
      <>
        <Summary totals={totals} money={money} />
        {confirmed.length === 0 && detected.length === 0 && (
          <Text className="font-sans text-base text-muted-foreground">{t.empty}</Text>
        )}
        {detected.length > 0 && (
          <View className="gap-3">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {t.detectedTitle}
            </Text>
            <Text className="font-sans text-base text-muted-foreground">{t.detectedIntro}</Text>
            {detected.map((item) => (
              <DetectedItem
                key={item.key}
                item={item}
                name={nameOf(item)}
                money={money}
                busy={
                  (confirm.isPending && confirm.variables.key === item.key) ||
                  (dismiss.isPending && dismiss.variables.key === item.key)
                }
                onConfirm={() => {
                  confirm.mutate(item);
                }}
                onDismiss={() => {
                  dismiss.mutate(item);
                }}
              />
            ))}
          </View>
        )}
        {confirmed.length > 0 && (
          <View className="gap-2">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              {t.confirmedTitle}
            </Text>
            {confirmed.map((item) => (
              <ConfirmedRow key={item.ruleId} item={item} money={money} />
            ))}
          </View>
        )}
        {(confirmed.length > 0 || detected.length > 0) && (
          <Text className="font-sans text-sm text-muted-foreground">{t.howItWorks}</Text>
        )}
      </>
    );
  }

  return (
    <Screen title={t.title}>
      {notice?.kind === "error" && <FormAlert tone="error">{t.saveFailed}</FormAlert>}
      {notice && notice.kind !== "error" && (
        <View className="gap-2">
          <FormAlert tone="info">{notice.text}</FormAlert>
          {notice.kind === "dismissed" && (
            <Button
              variant="ghost"
              loading={undo.isPending}
              onPress={() => {
                undo.mutate(notice.key);
              }}
            >
              {t.undo}
            </Button>
          )}
        </View>
      )}
      {body}
      <BackButton />
    </Screen>
  );
}

function Summary({
  totals,
  money,
}: {
  totals: {
    confirmed: { count: number; monthly: number; yearly: number };
    detected: { count: number; monthly: number };
  };
  money: Money;
}) {
  return (
    <Card title={t.yours}>
      <Text className="font-heading text-2xl text-card-foreground">
        {totals.confirmed.count > 0
          ? t.total(
              money.format(grosze(totals.confirmed.monthly), { whole: "up" }),
              money.format(grosze(totals.confirmed.yearly), { whole: "up" }),
            )
          : t.noneConfirmed}
      </Text>
      {totals.detected.count > 0 && (
        <Text className="font-sans text-base text-muted-foreground">
          {t.toReview(
            totals.detected.count,
            money.format(grosze(totals.detected.monthly), { whole: "up" }),
          )}
        </Text>
      )}
    </Card>
  );
}

function DetectedItem({
  item,
  name,
  money,
  busy,
  onConfirm,
  onDismiss,
}: {
  item: DetectedSubscriptionOutput;
  name: string;
  money: Money;
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <View testID={`detected-${item.key}`} className="gap-3 rounded-2xl bg-card p-4">
      <View className="gap-0.5">
        <Text className="font-sans-semibold text-base text-card-foreground">{name}</Text>
        <Text className="font-sans text-sm text-muted-foreground">
          {t.row(money.format(grosze(item.amount)), frequencyText(item.frequency))}
        </Text>
        <Text className="font-sans text-sm text-muted-foreground">{costText(money, item)}</Text>
        <Text className="font-sans text-sm text-muted-foreground">
          {t.dates(formatDayMonth(item.lastDate), formatDayMonth(item.nextDate))}
        </Text>
        {item.priceChange && (
          <Text className="font-sans-semibold text-sm text-card-foreground">
            {priceChangeText(money, item.priceChange)}
          </Text>
        )}
      </View>
      <Button
        accessibilityLabel={t.forItem(t.confirm, name)}
        loading={busy}
        loadingLabel={t.confirming}
        onPress={onConfirm}
      >
        {t.confirm}
      </Button>
      <Button
        variant="outline"
        accessibilityLabel={t.forItem(t.dismiss, name)}
        loading={busy}
        onPress={onDismiss}
      >
        {t.dismiss}
      </Button>
    </View>
  );
}

function ConfirmedRow({ item, money }: { item: ConfirmedSubscriptionOutput; money: Money }) {
  const details = [
    t.row(money.format(grosze(item.amount)), frequencyText(item.frequency, item.interval)),
    costText(money, item),
  ];
  if (item.priceChange) details.push(priceChangeText(money, item.priceChange));
  return (
    <ListRow
      name={item.name}
      details={details}
      onPress={() => {
        router.push(`/settings/commitments/${item.ruleId}`);
      }}
    />
  );
}
