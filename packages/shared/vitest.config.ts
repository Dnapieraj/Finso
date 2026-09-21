import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
    // Etap 0: pusty pakiet, logika budżetu (i jej testy) wchodzą w etapie 2.
    passWithNoTests: true,
  },
});
