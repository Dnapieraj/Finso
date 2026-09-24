import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @vireo/tokens and @vireo/ui ship TypeScript source, so Next compiles them like app code.
  transpilePackages: ["@vireo/tokens", "@vireo/ui"],
};

export default nextConfig;
