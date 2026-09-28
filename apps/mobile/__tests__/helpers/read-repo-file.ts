// Only this call needs Node; typed locally so the React Native project
// does not get Node's globals through @types/node.
const fs = jest.requireActual<{ readFileSync(path: string, encoding: "utf8"): string }>("fs");

/** Reads a file by its path from the repository root, e.g. `apps/web/...`. */
export function readRepoFile(pathFromRoot: string): string {
  const testPath = expect.getState().testPath ?? "";
  const root = testPath.slice(0, testPath.search(/[\\/]apps[\\/]mobile[\\/]/));
  return fs.readFileSync(`${root}/${pathFromRoot}`, "utf8");
}
