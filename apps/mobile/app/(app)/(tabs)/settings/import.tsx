import { useMutation } from "@tanstack/react-query";
import { grosze, IMPORT_MAX_ROWS, type ImportTransactionsInput } from "@vireo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { api } from "../../../../src/api";
import { pickStatement, type Statement } from "../../../../src/bank-import/read-statement";
import { Button } from "../../../../src/components/button";
import { FormAlert } from "../../../../src/components/form-alert";
import { Screen } from "../../../../src/components/screen";
import { haptics } from "../../../../src/feedback/haptics";
import { formatFullDate } from "../../../../src/format/date";
import { plural } from "../../../../src/format/plural";
import { refreshAfterExpenseChange } from "../../../../src/history/queries";
import { pl } from "../../../../src/messages/pl";
import { useMoney, type Money } from "../../../../src/privacy/money";
import { useDraft } from "../../../../src/settings/forms";

const t = pl.bankImport;

/** „1 wpływ, 1 w obcej walucie” — only the kinds that occurred. */
function skippedText(skipped: Extract<Statement, { kind: "ready" }>["skipped"]): string | null {
  const parts = [
    skipped.income > 0 && `${String(skipped.income)} ${plural(skipped.income, t.skippedIncome)}`,
    skipped.foreignCurrency > 0 && `${String(skipped.foreignCurrency)} ${t.skippedForeign}`,
    skipped.invalid > 0 &&
      `${String(skipped.invalid)} ${plural(skipped.invalid, t.skippedInvalid)}`,
  ].filter((part) => part !== false);
  return parts.length > 0 ? t.skipped(parts.join(", ")) : null;
}

function problemText(kind: Exclude<Statement["kind"], "ready">): string {
  if (kind === "no-columns") return t.noColumns;
  if (kind === "no-expenses") return t.noExpenses;
  return t.tooMany(IMPORT_MAX_ROWS);
}

/**
 * Bank statement import (PRODUCT.md, Faza 2, punkt 19): pick a CSV, see what
 * it holds, import the expenses. The API skips those already in Finso (same
 * date and amount), so a statement covering hand-entered expenses does not
 * count them twice.
 */
export default function ImportScreen() {
  const money = useMoney();
  const [statement, setStatement] = useState<Statement | null>(null);
  const draft = useDraft((input: ImportTransactionsInput) => api.transactions.draftImport(input));

  const pick = useMutation({
    mutationFn: pickStatement,
    onSuccess: (picked) => {
      // Cancelled: keep what was on the screen.
      if (picked) setStatement(picked);
    },
    onError: haptics.failed,
  });
  const importRows = useMutation({
    mutationFn: (input: ImportTransactionsInput) => api.transactions.importRows(draft(input)),
    onSuccess: () => {
      haptics.saved();
      refreshAfterExpenseChange();
    },
    onError: haptics.failed,
  });

  const ready = statement?.kind === "ready" ? statement : null;
  return (
    <Screen back title={t.title}>
      <Text className="font-sans text-base text-muted-foreground">{t.intro}</Text>
      <Text className="font-sans text-sm text-muted-foreground">{t.dedupe}</Text>
      {pick.isError && <FormAlert tone="error">{t.unreadable}</FormAlert>}
      {statement && statement.kind !== "ready" && (
        <FormAlert tone="error">{problemText(statement.kind)}</FormAlert>
      )}
      {importRows.data ? (
        <Done imported={importRows.data.imported} duplicates={importRows.data.duplicates} />
      ) : (
        <>
          {ready && <Preview statement={ready} money={money} />}
          {importRows.isError && <FormAlert tone="error">{t.failed}</FormAlert>}
          {ready && (
            <Button
              loading={importRows.isPending}
              loadingLabel={t.importing}
              onPress={() => {
                importRows.mutate({ rows: ready.expenses });
              }}
            >
              {t.importButton(ready.expenses.length, plural(ready.expenses.length, t.expenses))}
            </Button>
          )}
          <Button
            variant={ready ? "ghost" : "primary"}
            loading={pick.isPending}
            loadingLabel={t.reading}
            onPress={() => {
              importRows.reset();
              pick.mutate();
            }}
          >
            {statement ? t.pickAnother : t.pick}
          </Button>
        </>
      )}
    </Screen>
  );
}

function Preview({
  statement,
  money,
}: {
  statement: Extract<Statement, { kind: "ready" }>;
  money: Money;
}) {
  const count = statement.expenses.length;
  const summary = t.summary(
    count,
    plural(count, t.expenses),
    formatFullDate(statement.from),
    formatFullDate(statement.to),
    // Exact: these are the bank's own amounts.
    money.format(grosze(statement.total)),
  );
  const skipped = skippedText(statement.skipped);
  return (
    <View className="gap-2 rounded-2xl bg-card p-4">
      <Text
        accessibilityLabel={money.spoken(summary)}
        className="font-sans text-base text-card-foreground"
      >
        {summary}
      </Text>
      {skipped && <Text className="font-sans text-sm text-muted-foreground">{skipped}</Text>}
    </View>
  );
}

function Done({ imported, duplicates }: { imported: number; duplicates: number }) {
  return (
    <View className="gap-3">
      <FormAlert tone="info">
        {[
          t.done(imported, plural(imported, t.expenses)),
          duplicates > 0 ? t.duplicates(duplicates, plural(duplicates, t.wasThere)) : null,
        ]
          .filter(Boolean)
          .join(" ")}
      </FormAlert>
      <Button
        variant="outline"
        onPress={() => {
          router.push("/history");
        }}
      >
        {t.openHistory}
      </Button>
    </View>
  );
}
