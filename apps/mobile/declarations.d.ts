// global.css is compiled by NativeWind's Metro plugin, not imported as a module.
declare module "*.css";

// NativeWind 4 ships this preset without type declarations (its .d.ts is empty).
declare module "nativewind/preset" {
  import type { Config } from "tailwindcss";

  const preset: Partial<Config>;
  export default preset;
}
