import type { NextConfig } from "next";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@ivxp/protocol", "@ivxp/sdk"],
  turbopack: {},
  poweredByHeader: false,
};

// Copy providers.json to build output during build
if (process.env.NODE_ENV === "production") {
  try {
    const srcPath = join(process.cwd(), "src", "data", "registry", "providers.json");
    const destDir = join(process.cwd(), ".next", "server", "data", "registry");
    const destPath = join(destDir, "providers.json");

    mkdirSync(destDir, { recursive: true });
    copyFileSync(srcPath, destPath);
  } catch (error) {
    console.warn("Failed to copy providers.json:", error);
  }
}

export default nextConfig;
