const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Expo detects the pnpm monorepo on its own (SDK 52+), so no watchFolders here.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  configPath: "./tailwind.config.ts",
});
