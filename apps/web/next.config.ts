import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @vireo/ui ships TypeScript source, so Next has to compile it like app code.
  transpilePackages: ["@vireo/ui"],
};

export default nextConfig;
