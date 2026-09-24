import { defineConfig } from "vitest/config";

// Token logic (and its 100% coverage bar) lives in @vireo/tokens; components
// are covered by Playwright on real screens. Here only theme.css is checked.
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
  },
});
