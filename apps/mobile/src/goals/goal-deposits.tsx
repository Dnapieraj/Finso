import { useMutation, useQuery } from "@tanstack/react-query";
import {
  grosze,
  parseMoneyInput,
  type CreateGoalDepositRequest,
  type Goal,
  type GoalDeposit,
  type IdempotentDraft,
} from "@vireo/shared";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { api } from "../api";
import { Button } from "../components/button";
import { FormAlert } from "../components/form-alert";
import { LoadError, Skeleton } from "../components/query-states";
import { TextField } from "../components/text-field";
import { useBudget } from "../dashboard/queries";
import { haptics } from "../feedback/haptics";
import { formatDayMonth } from "../format/date";
import { pl } from "../messages/pl";
import { amountError } from "../onboarding/draft";
import { useMoney } from "../privacy/money";
import { queryClient } from "../query-client";
import { refreshBudget } from "../settings/queries";

const t = pl.goals.deposits;

type Notice =
  | { kind: "deposited"; amount: number }
  | { kind: "removed"; deposit: GoalDeposit }
  | { kind: "restore-failed"; deposit: GoalDeposit };

/** Under ["goals"], so whatever refreshes the goals refreshes their deposits too. */
const depositsKey = (goalId: string) => ["goals", goalId, "deposits"] as const;

/** A deposit changes the goal's total and maybe the budget: refresh all three. */
function refreshAfterDeposit() {
  void queryClient.invalidateQueries({ queryKey: ["goals"] });
  void refreshBudget();
}

/**
 * "Wpłać na cel" and the history of deposits. A deposit inside this period's
 * instalment leaves "Możesz wydać" as it is; one above it lowers it — the
 * budget engine decides, the screen only says how much is paid in.
 */
export function GoalDeposits({ goal }: { goal: Goal }) {
  const money = useMoney();
  const budget = useBudget();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<Notice | null>(null);
  // One key per deposit: a retry after a failure resends it, a new deposit
  // (even of the same amount) gets a new one once the last one is saved.
  const draft = useRef<IdempotentDraft<CreateGoalDepositRequest> | null>(null);

  const deposits = useQuery({
    queryKey: depositsKey(goal.id),
    queryFn: () => api.goalDeposits.list(goal.id),
  });

  const deposit = useMutation({
    mutationFn: (request: IdempotentDraft<CreateGoalDepositRequest>) =>
      api.goalDeposits.create(request),
    onSuccess: (saved) => {
      draft.current = null;
      setAmount("");
      setNotice({ kind: "deposited", amount: saved.amount });
      haptics.saved();
      refreshAfterDeposit();
    },
    onError: haptics.failed,
  });
  const remove = useMutation({
    mutationFn: (item: GoalDeposit) => api.goalDeposits.remove(goal.id, item.id),
    onSuccess: (_result, item) => {
      setNotice({ kind: "removed", deposit: item });
      refreshAfterDeposit();
    },
    onError: haptics.failed,
  });
  const restore = useMutation({
    mutationFn: (item: GoalDeposit) => api.goalDeposits.restore(goal.id, item.id),
    onSuccess: () => {
      setNotice(null);
      refreshAfterDeposit();
    },
    onError: (_error, item) => {
      setNotice({ kind: "restore-failed", deposit: item });
    },
  });

  function submit() {
    const parsed = parseMoneyInput(amount);
    if (!parsed.ok) {
      setError(amountError(parsed.reason));
      haptics.failed();
      return;
    }
    const input = { goalId: goal.id, amount: parsed.grosze };
    if (draft.current?.input.amount !== input.amount) {
      draft.current = api.goalDeposits.draft(input);
    }
    deposit.mutate(draft.current);
  }

  const line = budget.data?.goalContributions.find((item) => item.goalId === goal.id);
  const exact = (value: number) => money.format(grosze(value));

  let history;
  if (deposits.isPending) {
    history = <Skeleton label={t.loading} lines={2} />;
  } else if (deposits.isError) {
    history = <LoadError message={t.error} onRetry={() => void deposits.refetch()} />;
  } else if (deposits.data.length === 0) {
    history = <Text className="font-sans text-base text-muted-foreground">{t.empty}</Text>;
  } else {
    history = (
      <View accessibilityRole="list" accessibilityLabel={t.history} className="gap-2">
        {deposits.data.map((item) => (
          <View
            key={item.id}
            className="flex-row items-center justify-between gap-3 rounded-xl bg-card px-4 py-2"
          >
            <View className="flex-1">
              <Text className="font-sans-semibold text-base text-card-foreground">
                {exact(item.amount)}
              </Text>
              <Text className="font-sans text-sm text-muted-foreground">
                {formatDayMonth(item.date)}
              </Text>
            </View>
            <Button
              variant="ghost"
              accessibilityLabel={money.spoken(
                t.removeLabel(exact(item.amount), formatDayMonth(item.date)),
              )}
              loading={remove.isPending && remove.variables.id === item.id}
              onPress={() => {
                remove.mutate(item);
              }}
            >
              {t.remove}
            </Button>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
        {t.title}
      </Text>
      {line && (
        <Text className="font-sans text-sm text-muted-foreground">
          {t.thisPeriod(exact(line.deposited), exact(line.amount))}
        </Text>
      )}
      {(deposit.isError || remove.isError) && (
        <FormAlert tone="error">{deposit.isError ? t.failed : t.removeFailed}</FormAlert>
      )}
      {notice && (
        <DepositNotice
          notice={notice}
          format={exact}
          restoring={restore.isPending}
          onUndo={(item) => {
            restore.mutate(item);
          }}
        />
      )}
      <TextField
        label={t.amount}
        value={amount}
        onChangeText={(text) => {
          setAmount(text);
          setError(undefined);
        }}
        error={error}
        keyboardType="decimal-pad"
      />
      <Button loading={deposit.isPending} loadingLabel={t.depositing} onPress={submit}>
        {t.deposit}
      </Button>
      {history}
    </View>
  );
}

function DepositNotice({
  notice,
  format,
  restoring,
  onUndo,
}: {
  notice: Notice;
  format: (value: number) => string;
  restoring: boolean;
  onUndo: (deposit: GoalDeposit) => void;
}) {
  if (notice.kind === "deposited") {
    return <FormAlert tone="info">{t.deposited(format(notice.amount))}</FormAlert>;
  }
  const failed = notice.kind === "restore-failed";
  return (
    <View className="gap-2">
      <FormAlert tone={failed ? "error" : "info"}>
        {failed ? t.restoreFailed : t.removed(format(notice.deposit.amount))}
      </FormAlert>
      <Button
        variant="outline"
        loading={restoring}
        onPress={() => {
          onUndo(notice.deposit);
        }}
      >
        {failed ? pl.common.retry : pl.goals.undo}
      </Button>
    </View>
  );
}
