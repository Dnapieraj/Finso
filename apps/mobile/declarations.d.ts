// global.css is compiled by NativeWind's Metro plugin, not imported as a module.
declare module "*.css";

// NativeWind 4 ships this preset without type declarations (its .d.ts is empty).
declare module "nativewind/preset" {
  import type { Config } from "tailwindcss";

  const preset: Partial<Config>;
  export default preset;
}

// Expo inlines EXPO_PUBLIC_* at build time; Metro's typings leave process.env
// as `any`, so the variables the app reads are declared here.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}
