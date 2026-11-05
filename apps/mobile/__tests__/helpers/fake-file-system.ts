/**
 * In-memory stand-in for expo-file-system, mocked globally in jest.setup.js:
 * there is no device storage under Jest. Tests read what the app wrote.
 */
const files = new Map<string, string>();
/** Files the user "picked" (e.g. a bank statement), by uri. */
const picked = new Map<string, Uint8Array>();

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

  bytes(): Promise<Uint8Array> {
    const bytes = picked.get(this.uri);
    return bytes ? Promise.resolve(bytes) : Promise.reject(new Error(`No file at ${this.uri}`));
  }
}

/** Puts a file on the fake device, e.g. one the document picker returns. */
export function putFile(uri: string, bytes: Uint8Array): void {
  picked.set(uri, bytes);
}

/** What was written at `uri`, or undefined. */
export function writtenFile(uri: string): string | undefined {
  return files.get(uri);
}

export function resetFileSystem(): void {
  files.clear();
  picked.clear();
}
