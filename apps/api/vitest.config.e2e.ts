import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Etap 0: szkielet bez logiki biznesowej, więc jeszcze brak testów.
    // Usunąć, gdy pojawią się pierwsze *.e2e-spec.ts.
    passWithNoTests: true,
  },
});
