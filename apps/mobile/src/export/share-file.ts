import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** The phone has no share sheet to hand the file to. */
export class SharingUnavailableError extends Error {}

/**
 * Writes the CSV to the app's cache (the OS may clear it; the user keeps
 * the copy they shared) and opens the system share sheet.
 */
export async function shareCsv(fileName: string, csv: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new SharingUnavailableError();
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle,
  });
}
