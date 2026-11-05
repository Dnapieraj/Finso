import {
  decodeBankFile,
  IMPORT_MAX_ROWS,
  parseBankCsv,
  type BankCsvExpense,
  type BankCsvResult,
} from "@vireo/shared";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

/** What the picked statement holds, or why it cannot be imported. */
export type Statement =
  | {
      kind: "ready";
      expenses: BankCsvExpense[];
      skipped: Extract<BankCsvResult, { ok: true }>["skipped"];
      from: string;
      to: string;
      total: number;
    }
  | { kind: "no-columns" | "no-expenses" | "too-many" };

/**
 * The system file picker, then the file read and parsed on the phone — the
 * statement never leaves it except as the expenses the user imports.
 * `null` = the user cancelled. Any file type is offered: Android reports
 * CSV under several MIME types, and the parser decides what is a statement.
 */
export async function pickStatement(): Promise<Statement | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  return readStatement(decodeBankFile(await new File(asset.uri).bytes()));
}

function readStatement(text: string): Statement {
  const parsed = parseBankCsv(text);
  if (!parsed.ok) return { kind: "no-columns" };
  const { expenses, skipped } = parsed;
  if (expenses.length === 0) return { kind: "no-expenses" };
  if (expenses.length > IMPORT_MAX_ROWS) return { kind: "too-many" };
  const dates = expenses.map((expense) => expense.date).sort();
  return {
    kind: "ready",
    expenses,
    skipped,
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
    total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
  };
}
