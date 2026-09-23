/**
 * Osobna baza na testy e2e, w tym samym kontenerze co deweloperska.
 * Można nadpisać zmienną TEST_DATABASE_URL (np. w CI).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://finso:finso@localhost:5432/finso_test';
