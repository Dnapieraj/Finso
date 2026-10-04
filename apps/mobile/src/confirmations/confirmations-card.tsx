import {
  parseMoneyInput,
  type AnswerConfirmationRequest,
  type DueConfirmation,
} from "@vireo/shared";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { LoadError } from "../components/query-states";
import { TextField } from "../components/text-field";
import { formatDayMonth } from "../format/date";
import { pl } from "../messages/pl";
import {
  markRemindersPrompted,
  requestNotificationPermission,
  shouldAskForReminders,
} from "../notifications/preferences";
import { amountError } from "../onboarding/draft";
import { toMoneyInput } from "../settings/forms";
import { formatExpected } from "./format";
import { useAnswerConfirmation, useConfirmations } from "./queries";

const t = pl.confirmations;

type Answer = AnswerConfirmationRequest["answer"];

function DueItem({ item, onAnswered }: { item: DueConfirmation; onAnswered: () => void }) {
  const answer = useAnswerConfirmation();
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState(() => toMoneyInput(item.expectedAmount));
  const [amountProblem, setAmountProblem] = useState<string>();

  const amount = formatExpected(item.expectedAmount);
  const date = formatDayMonth(item.occurrenceDate);
  const named = (action: string) => t.forItem(action, item.label);

  function send(reply: Answer, confirmedAmount?: number) {
    answer.mutate(
      {
        kind: item.kind,
        ...(item.kind === "INCOME" ? { incomeSourceId: item.id } : { recurringRuleId: item.id }),
        occurrenceDate: item.occurrenceDate,
        answer: reply,
        ...(confirmedAmount === undefined ? {} : { amount: confirmedAmount }),
      },
      { onSuccess: onAnswered },
    );
  }

  function saveOtherAmount() {
    const parsed = parseMoneyInput(amountText);
    if (!parsed.ok) {
      setAmountProblem(amountError(parsed.reason));
      return;
    }
    setAmountProblem(undefined);
    send("CONFIRMED", parsed.grosze);
  }

  const option = (label: string, reply: () => void, variant: "primary" | "outline" = "outline") => (
    <View className="grow">
      <Button
        variant={variant}
        accessibilityLabel={named(label)}
        loading={answer.isPending}
        onPress={reply}
      >
        {label}
      </Button>
    </View>
  );

  let actions: ReactNode;
  if (editing) {
    actions = (
      <View className="gap-3">
        <TextField
          label={t.amount}
          accessibilityLabel={named(t.amount)}
          value={amountText}
          onChangeText={setAmountText}
          error={amountProblem}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={saveOtherAmount}
          autoFocus
        />
        <View className="flex-row flex-wrap gap-2">
          {option(t.save, saveOtherAmount, "primary")}
          {option(t.cancel, () => {
            setEditing(false);
            setAmountProblem(undefined);
          })}
        </View>
      </View>
    );
  } else {
    actions = (
      <View className="flex-row flex-wrap gap-2">
        {option(
          t.yes,
          () => {
            send("CONFIRMED");
          },
          "primary",
        )}
        {option(t.otherAmount, () => {
          setEditing(true);
        })}
        {/* After „Jeszcze nie” today: no point asking it again, the others stay. */}
        {item.askToday &&
          option(t.notYet, () => {
            send("NOT_YET");
          })}
        {/* Income cannot be skipped: money that never came is not a choice. */}
        {item.kind === "EXPENSE" &&
          option(t.skip, () => {
            send("SKIPPED");
          })}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="font-sans-semibold text-base text-card-foreground">
          {item.askToday
            ? t.ask(item.label, amount, item.kind)
            : t.notYetState(item.label, amount, item.kind)}
        </Text>
        <Text
          className={`font-sans text-sm ${item.overdue ? "text-caution" : "text-muted-foreground"}`}
        >
          {item.overdue ? t.overdue(date) : t.due(date)}
        </Text>
      </View>
      {actions}
      {answer.isError && (
        <Text accessibilityLiveRegion="polite" className="font-sans text-sm text-destructive">
          {t.answerFailed}
        </Text>
      )}
    </View>
  );
}

/**
 * „Wpłynęło? / Zapłacone?” on the dashboard. Hidden while loading and when
 * nothing waits, because most days there is nothing to answer and a
 * placeholder would only make the budget jump down the screen.
 */
/**
 * Asked in the app first, right after the user has seen what the reminders
 * would be about; the system dialog comes only after „Tak”, because a
 * refusal there can only be undone in the phone settings.
 */
function RemindersPrompt({ onDone }: { onDone: () => void }) {
  async function answer(wantsReminders: boolean) {
    await markRemindersPrompted();
    if (wantsReminders) await requestNotificationPermission();
    onDone();
  }

  return (
    <Card>
      <Text className="font-sans-semibold text-base text-card-foreground">
        {pl.notifications.ask}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <View className="grow">
          <Button onPress={() => void answer(true)}>{pl.notifications.askYes}</Button>
        </View>
        <View className="grow">
          <Button variant="outline" onPress={() => void answer(false)}>
            {pl.notifications.askLater}
          </Button>
        </View>
      </View>
    </Card>
  );
}

export function ConfirmationsCard() {
  const due = useConfirmations();
  const [askingAboutReminders, setAskingAboutReminders] = useState(false);

  function answered() {
    void shouldAskForReminders().then((ask) => {
      if (ask) setAskingAboutReminders(true);
    });
  }

  const prompt = askingAboutReminders && (
    <RemindersPrompt
      onDone={() => {
        setAskingAboutReminders(false);
      }}
    />
  );

  if (due.isPending) return null;
  if (due.isError) {
    return (
      <Card title={t.title}>
        <LoadError message={t.loadError} onRetry={() => void due.refetch()} />
      </Card>
    );
  }
  // The last answer empties the card, but the question still has to show.
  if (due.data.length === 0) return prompt || null;
  return (
    <>
      {prompt}
      <Card title={t.title}>
        {due.data.map((item, index) => (
          <View key={`${item.id}:${item.occurrenceDate}`} className="gap-4">
            {/* Decorative: the text and buttons carry the meaning, so no 3:1 needed. */}
            {index > 0 && <View className="h-px bg-border" />}
            <DueItem item={item} onAnswered={answered} />
          </View>
        ))}
      </Card>
    </>
  );
}
