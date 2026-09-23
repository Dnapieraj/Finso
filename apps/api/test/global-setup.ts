import { execSync } from 'node:child_process';

import pg from 'pg';

import { TEST_DATABASE_URL } from './test-env.js';

/** Tworzy bazę testową (jeśli nie istnieje) i nakłada na nią migracje. */
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  // CREATE DATABASE trzeba wykonać z połączenia do INNEJ bazy.
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount === 0) {
      // Identyfikator nie może być parametrem zapytania — stąd cytowanie
      // ręczne. Nazwa pochodzi z naszej konfiguracji, nie od użytkownika.
      await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  execSync('pnpm prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
