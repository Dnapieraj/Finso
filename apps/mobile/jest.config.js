/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  // Call history resets between tests; default implementations (fake API) stay.
  clearMocks: true,
  // The root layout imports global.css for NativeWind; Metro compiles it,
  // under Jest it is an empty module.
  moduleNameMapper: {
    "\.css$": "<rootDir>/__tests__/helpers/empty-module.js",
    // Jest resolves the "react-native" export condition to lucide's ESM
    // .mjs build, which it does not transform; the CommonJS build is the
    // same icons.
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.{ts,tsx}"],
};
