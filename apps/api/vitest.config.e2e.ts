import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

import { TEST_DATABASE_URL } from './test/test-env.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Pliki współdzielą jedną bazę testową i czyszczą ją w beforeEach —
    // równoległe pliki kasowałyby sobie nawzajem dane w trakcie testu.
    fileParallelism: false,
    // argon2 celowo jest wolny (~50-100 ms na hash), a testy robią ich dużo.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Zmienne procesu mają pierwszeństwo przed .env w ConfigModule, więc
    // testy nigdy nie dotkną bazy deweloperskiej z .env.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      // Wysoki limit, żeby throttler nie psuł testów niezwiązanych z nim.
      // Sam rate limiting ma osobny test z nadpisanym, niskim limitem.
      AUTH_THROTTLE_LIMIT: '10000',
    },
  },
});
