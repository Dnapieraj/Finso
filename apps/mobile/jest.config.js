/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
  // The scaffold commit has no tests yet; the suite arrives in the next one.
  passWithNoTests: true,
};
