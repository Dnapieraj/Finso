import { useQuery } from "@tanstack/react-query";
import { grosze, parseMoneyInput, type Goal, type SimulationResult } from "@vireo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { api } from "../../../src/api";
import { Button } from "../../../src/components/button";
import { LoadError } from "../../../src/components/query-states";
import { Screen } from "../../../src/components/screen";
import { TextField } from "../../../src/components/text-field";
import { useGoals } from "../../../src/dashboard/queries";
import { plural } from "../../../src/format/plural";
import { useDebouncedValue } from "../../../src/hooks/use-debounced-value";
import { pl } from "../../../src/messages/pl";
import { useMoney } from "../../../src/privacy/money";

const t = pl.simulator;

/** Wait for the user to stop typing before asking the API. */
const DEBOUNCE_MS = 400;

const VERDICT_STYLE = {
  safe: { box: "border-safe bg-safe-subtle", text: "text-safe" },
  tight: { box: "border-caution bg-caution-subtle", text: "text-caution" },
  over: { box: "border-risk bg-risk-subtle", text: "text-risk" },
} as const;

function Verdict({ result }: { result: SimulationResult }) {
  const money = useMoney();
  const style = VERDICT_STYLE[result.riskLevel];
  const lines =
    result.remainingAfter < 0
      ? // A shortfall rounds up: showing less than is missing would mislead.
        [t.shortfall(money.format(grosze(-result.remainingAfter), { whole: "up" }))]
      : [
          t.remaining(money.format(grosze(result.remainingAfter), { whole: "down" })),
          t.perDay(
            money.format(grosze(result.dailyAllowanceAfter), { whole: "down" }),
            money.format(grosze(result.before.dailyAllowance), { whole: "down" }),
          ),
        ];

  return (
    // The verdict is said in words as well as colour, and read out when it
    // changes, so it does not depend on seeing the colour.
    <View
      accessibilityLiveRegion="polite"
      className={`gap-1 rounded-2xl border-2 p-5 ${style.box}`}
    >
      <Text accessibilityRole="header" className={`font-heading text-2xl ${style.text}`}>
        {t.verdict[result.riskLevel]}
      </Text>
      {lines.map((line) => (
        <Text
          key={line}
          accessibilityLabel={money.spoken(line)}
          className="font-sans text-base text-foreground"
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

/**
 * Each goal's delay exactly as the engine computed it: independently per
 * goal, as if that goal alone absorbed the shortfall. Never summed or
 * split — the numbers do not add up to one scenario.
 */
function GoalImpacts({ result, goals }: { result: SimulationResult; goals: Goal[] }) {
  const names = new Map(goals.map((goal) => [goal.id, goal.name]));
  const delayed = result.goalImpacts.filter(
    (impact) => impact.delayDays > 0 && names.has(impact.goalId),
  );

  return (
    <View className="gap-2 rounded-2xl bg-card p-5">
      <Text accessibilityRole="header" className="font-heading text-xl text-card-foreground">
        {t.goals}
      </Text>
      {delayed.length === 0 ? (
        <Text className="font-sans text-base text-muted-foreground">{t.noGoalImpact}</Text>
      ) : (
        delayed.map((impact) => (
          <Text key={impact.goalId} className="font-sans text-base text-card-foreground">
            {t.goalDelay(
              names.get(impact.goalId) ?? "",
              `${String(impact.delayDays)} ${plural(impact.delayDays, t.days)}`,
            )}
          </Text>
        ))
      )}
      {delayed.length > 1 && (
        <Text className="font-sans text-sm text-muted-foreground">{t.independentGoals}</Text>
      )}
    </View>
  );
}

/**
 * „Czy stać mnie na to teraz”: a planned purchase against the budget and
 * the goals, before any money is spent — just the amount. Nothing is saved
 * until „Zapisz jako wydatek”, which opens the quick add with the amount
 * filled in: one tap on a category saves it.
 */
export default function SimulatorScreen() {
  const [amountText, setAmountText] = useState("");
  const goals = useGoals();

  const debouncedAmount = useDebouncedValue(amountText, DEBOUNCE_MS);
  const parsed = parseMoneyInput(debouncedAmount);
  const request = parsed.ok ? { amount: parsed.grosze } : null;

  const simulation = useQuery({
    queryKey: ["simulation", request?.amount],
    queryFn: () => {
      if (!request) throw new Error("No purchase to simulate");
      return api.budget.simulate(request);
    },
    enabled: request !== null,
  });

  const amountError =
    !parsed.ok && parsed.reason !== "empty" ? pl.addExpense.amountErrors[parsed.reason] : undefined;

  function saveAsExpense() {
    router.push({ pathname: "/add-expense", params: { amount: amountText.trim() } });
    setAmountText("");
  }

  let result: ReactNode;
  if (!request) {
    result = <Text className="font-sans text-base text-muted-foreground">{t.hint}</Text>;
  } else if (simulation.isPending) {
    result = (
      <View accessible accessibilityLabel={t.calculating} className="items-center py-6">
        <ActivityIndicator />
      </View>
    );
  } else if (simulation.isError) {
    result = <LoadError message={t.error} onRetry={() => void simulation.refetch()} />;
  } else {
    result = (
      <>
        <Verdict result={simulation.data} />
        <GoalImpacts result={simulation.data} goals={goals.data ?? []} />
        <Button onPress={saveAsExpense}>{t.save}</Button>
      </>
    );
  }

  return (
    <Screen title={t.title}>
      <TextField
        label={t.amount}
        value={amountText}
        onChangeText={setAmountText}
        error={amountError}
        keyboardType="decimal-pad"
      />
      {result}
    </Screen>
  );
}
