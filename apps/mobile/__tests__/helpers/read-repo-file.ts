// Only this call needs Node; typed locally so the React Native project
// does not get Node's globals through @types/node.
const fs = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
  readFileSync(path: string): Uint8Array;
  existsSync(path: string): boolean;
}>("fs");

function repoRoot(): string {
  const testPath = expect.getState().testPath ?? "";
  return testPath.slice(0, testPath.search(/[\\/]apps[\\/]mobile[\\/]/));
}

/** Reads a file by its path from the repository root, e.g. `apps/web/...`. */
export function readRepoFile(pathFromRoot: string): string {
  return fs.readFileSync(`${repoRoot()}/${pathFromRoot}`, "utf8");
}

/** The raw bytes of a file from the repository root. */
export function readRepoBytes(pathFromRoot: string): Uint8Array {
  return fs.readFileSync(`${repoRoot()}/${pathFromRoot}`);
}

/** Whether a file exists, by its path from the repository root. */
export function repoFileExists(pathFromRoot: string): boolean {
  return fs.existsSync(`${repoRoot()}/${pathFromRoot}`);
}
