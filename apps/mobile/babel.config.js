// NativeWind turns `className` into React Native styles at compile time,
// so both the JSX runtime and the preset come from it.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
