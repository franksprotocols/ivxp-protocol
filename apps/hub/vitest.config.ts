import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["./src/test/setup.ts"],
    server: {
      deps: {
        inline: [/radix-ui/, /@radix-ui/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/components/**/*.tsx", "src/components/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["src/**/*.test.*", "src/**/index.ts", "src/test/**"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
