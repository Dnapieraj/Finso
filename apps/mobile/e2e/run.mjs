// Runs the Maestro flows in this directory against a running emulator.
// Maestro is a separate CLI (not an npm package): MAESTRO_BIN points at it,
// otherwise `maestro` must be on PATH. Usage telemetry is switched off.
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const bin = process.env.MAESTRO_BIN ?? "maestro";
const result = spawnSync(bin, ["test", dirname(fileURLToPath(import.meta.url))], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    MAESTRO_CLI_NO_ANALYTICS: "1",
    MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: "true",
  },
});
if (result.error) {
  console.error(`Cannot start Maestro (${bin}): ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
