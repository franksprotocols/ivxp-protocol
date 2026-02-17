import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: [
      // Integration tests require a running Anvil instance
      "src/__tests__/integration/**",
      // Interop tests require Python venv
      "src/__tests__/interop/**",
      // Docs-examples test imports from @ivxp/sdk package entry (requires build)
      "src/__tests__/docs-examples.test.ts",
      // Payment tests require a running Anvil instance
      "src/payment/transfer.test.ts",
      "src/payment/verify.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/**/index.ts"],
    },
  },
});
