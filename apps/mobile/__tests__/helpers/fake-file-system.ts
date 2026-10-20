/**
 * In-memory stand-in for expo-file-system, mocked globally in jest.setup.js:
 * there is no device storage under Jest. Tests read what the app wrote.
 */
const files = new Map<string, string>();

export const Paths = { cache: { uri: "file:///cache/" } };

export class File {
  readonly uri: string;

  constructor(...parts: (string | { uri: string })[]) {
    this.uri = parts.map((part) => (typeof part === "string" ? part : part.uri)).join("");
  }

  create(): void {
    files.set(this.uri, "");
  }

  write(content: string): void {
    files.set(this.uri, content);
  }
}

/** What was written at `uri`, or undefined. */
export function writtenFile(uri: string): string | undefined {
  return files.get(uri);
}

export function resetFileSystem(): void {
  files.clear();
}
