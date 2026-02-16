import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ivxp/protocol", "@ivxp/sdk"],
};

export default nextConfig;
