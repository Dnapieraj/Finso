/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
};
