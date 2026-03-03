import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent dev-time hydration ID drift from Radix/Fumadocs sidebar primitives.
  reactStrictMode: false,
  poweredByHeader: false,
  async rewrites() {
    return [
      // Allow AI agents to get page content as Markdown by appending .mdx
      // e.g. /docs/sdk/getting-started/quick-start-client.mdx
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
