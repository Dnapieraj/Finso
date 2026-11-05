/**
 * Stand-in for expo-document-picker, mocked globally in jest.setup.js: no
 * system file picker under Jest. By default the user cancels; tests pick a
 * file with `pickFile`.
 */
import type { DocumentPickerResult } from "expo-document-picker";

import { putFile } from "./fake-file-system";

export const getDocumentAsync = jest.fn<Promise<DocumentPickerResult>, []>(() =>
  Promise.resolve({ canceled: true, assets: null }),
);

/** The next pick returns this file (its bytes are on the fake device). */
export function pickFile(name: string, content: string | Uint8Array): void {
  const uri = `file:///picked/${name}`;
  putFile(uri, typeof content === "string" ? new TextEncoder().encode(content) : content);
  getDocumentAsync.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri, name, mimeType: "text/csv", lastModified: 0 }],
  });
}
