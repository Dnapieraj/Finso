/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  // Call history resets between tests; default implementations (fake API) stay.
  clearMocks: true,
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
};
