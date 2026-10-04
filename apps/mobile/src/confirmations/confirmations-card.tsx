import {
  formatMoney,
  grosze,
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
import { amountError } from "../onboarding/draft";
import { toMoneyInput } from "../settings/forms";
import { useAnswerConfirmation, useConfirmations } from "./queries";

const t = pl.confirmations;

type Answer = AnswerConfirmationRequest["answer"];

/**
 * The amount as the user will see it on the bank statement: exact grosze,
 * but "1500 zł" rather than "1500,00 zł" when there are none. Whole zloty
 * need no rounding, so the direction does not matter.
 */
function formatExpected(amount: number): string {
  return amount % 100 === 0
    ? formatMoney(grosze(amount), { whole: "down" })
    : formatMoney(grosze(amount));
}

function DueItem({ item }: { item: DueConfirmation }) {
  const answer = useAnswerConfirmation();
  const [editing, setEditing] = useState(false);
  const [amountText, setAmountText] = useState(() => toMoneyInput(item.expectedAmount));
  const [amountProblem, setAmountProblem] = useState<string>();

  const amount = formatExpected(item.expectedAmount);
  const date = formatDayMonth(item.occurrenceDate);
  const named = (action: string) => t.forItem(action, item.label);

  function send(reply: Answer, confirmedAmount?: number) {
    answer.mutate({
      kind: item.kind,
      ...(item.kind === "INCOME" ? { incomeSourceId: item.id } : { recurringRuleId: item.id }),
      occurrenceDate: item.occurrenceDate,
      answer: reply,
      ...(confirmedAmount === undefined ? {} : { amount: confirmedAmount }),
    });
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
export function ConfirmationsCard() {
  const due = useConfirmations();

  if (due.isPending) return null;
  if (due.isError) {
    return (
      <Card title={t.title}>
        <LoadError message={t.loadError} onRetry={() => void due.refetch()} />
      </Card>
    );
  }
  if (due.data.length === 0) return null;
  return (
    <Card title={t.title}>
      {due.data.map((item, index) => (
        <View key={`${item.id}:${item.occurrenceDate}`} className="gap-4">
          {/* Decorative: the text and buttons carry the meaning, so no 3:1 needed. */}
          {index > 0 && <View className="h-px bg-border" />}
          <DueItem item={item} />
        </View>
      ))}
    </Card>
  );
}
