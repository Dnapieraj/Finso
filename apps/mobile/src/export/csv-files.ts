import { formatMoney, grosze, toCsv, type ExportData } from "@vireo/shared";

import { pl } from "../messages/pl";
import { scheduleSummary } from "../settings/schedule";

const t = pl.exportData.csv;

/** The four files Settings → Eksport danych offers. */
export type ExportKind = "expenses" | "income" | "goals" | "commitments";

const FILE_STEMS: Record<ExportKind, string> = {
  expenses: "wydatki",
  income: "wplywy",
  goals: "cele",
  commitments: "stale-zobowiazania",
};

/** Exact grosze as a spreadsheet number: "1500,00", never rounded. */
const amount = (value: number) => formatMoney(grosze(value), { style: "spreadsheet" });
const yesNo = (value: boolean) => (value ? t.yes : t.no);

function rowsOf(data: ExportData, kind: ExportKind): string[][] {
  const category = (id: string | null) =>
    data.categories.find((item) => item.id === id)?.name ?? "";
  switch (kind) {
    case "expenses": {
      const ruleName = (id: string | null) =>
        data.recurringRules.find((rule) => rule.id === id)?.name ?? "";
      return data.expenses.map((expense) => [
        expense.date,
        amount(expense.amount),
        category(expense.categoryId),
        expense.note ?? "",
        t.expenseStatus[expense.status],
        ruleName(expense.recurringRuleId),
        expense.occurrenceDate ?? "",
        expense.beforeFinso ? t.yes : "",
      ]);
    }
    case "income": {
      const source = (id: string) => data.incomeSources.find((item) => item.id === id)?.name ?? "";
      return data.incomeEntries.map((entry) => [
        entry.date,
        amount(entry.amount),
        source(entry.incomeSourceId),
        t.incomeStatus[entry.status],
        entry.occurrenceDate ?? "",
      ]);
    }
    case "goals":
      return data.goals.map((goal) => [
        goal.name,
        amount(goal.targetAmount),
        amount(goal.currentAmount),
        goal.targetDate,
      ]);
    case "commitments":
      return data.recurringRules
        .filter((rule) => rule.kind === "EXPENSE")
        .map((rule) => [
          rule.name ?? "",
          amount(rule.expectedAmount ?? 0),
          scheduleSummary(rule),
          rule.startDate,
          category(rule.categoryId),
          yesNo(rule.isActive),
          yesNo(rule.isSubscription),
        ]);
  }
}

/**
 * One CSV file of the export: Polish column names, exact amounts as
 * spreadsheet numbers, dates as YYYY-MM-DD (spreadsheets read them as dates).
 */
export function buildExportFile(
  data: ExportData,
  kind: ExportKind,
): { fileName: string; csv: string } {
  return {
    fileName: `finso-${FILE_STEMS[kind]}-${data.exportedOn}.csv`,
    csv: toCsv(t[kind], rowsOf(data, kind)),
  };
}
