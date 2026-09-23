import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Components are covered by Playwright on real screens; the token
      // logic is pure and gets the same 100% bar as @vireo/shared.
      include: ["src/tokens/**/*.ts"],
      exclude: ["src/**/*.spec.ts"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
